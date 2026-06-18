import { type RTCDataChannel, RTCPeerConnection } from 'werift'

import { log } from '../../utils/fileLogger'
import { getSetting, upsertSetting } from '../settings'

const logger = {
  debug: (msg: string, data?: unknown) =>
    log('translation-stream', 'debug', msg, data),
  info: (msg: string, data?: unknown) =>
    log('translation-stream', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('translation-stream', 'warn', msg, data),
  error: (msg: string, data?: unknown) =>
    log('translation-stream', 'error', msg, data),
}

const SETTINGS_KEY = 'live_translation_stream_secret'
const SIGNALING_BASE_URL = 'https://churchub-backend.radiocrestin.ro'

// A fetched ICE server may carry `urls` as an array (Cloudflare TURN does);
// werift only accepts a single `urls` string, so we flatten before use.
type FetchedIceServer = {
  urls: string | string[]
  username?: string
  credential?: string
}
type IceServer = { urls: string; username?: string; credential?: string }

function flattenIceServers(servers: FetchedIceServer[]): IceServer[] {
  const out: IceServer[] = []
  for (const s of servers) {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls]
    for (const u of urls) {
      out.push({ urls: u, username: s.username, credential: s.credential })
    }
  }
  return out
}

const ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// STUN alone can't traverse the symmetric NAT used by most mobile/cellular
// networks, so phone listeners get stuck on "Connecting". A local override can
// be supplied as JSON in LIVE_TRANSLATION_TURN, e.g.
//   LIVE_TRANSLATION_TURN='[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]'
if (process.env.LIVE_TRANSLATION_TURN) {
  try {
    const turn = JSON.parse(process.env.LIVE_TRANSLATION_TURN)
    if (Array.isArray(turn)) ICE_SERVERS.push(...flattenIceServers(turn))
  } catch {
    logger.warn('LIVE_TRANSLATION_TURN is not valid JSON; ignoring')
  }
}

let cachedIce: { servers: IceServer[]; at: number } | null = null
const ICE_CACHE_MS = 20 * 60 * 1000

/**
 * ICE servers for listener peer connections. Prefer the signaling backend's
 * /signal/ice — it mints short-lived Cloudflare TURN credentials that listeners
 * use too, so both ends share the same relay (essential for cellular/symmetric
 * NAT). Falls back to local STUN (+ LIVE_TRANSLATION_TURN) if unreachable.
 */
async function getIceServers(): Promise<IceServer[]> {
  if (cachedIce && Date.now() - cachedIce.at < ICE_CACHE_MS) {
    return cachedIce.servers
  }
  try {
    const res = await fetch(`${SIGNALING_BASE_URL}/signal/ice`)
    if (res.ok) {
      const data = (await res.json()) as { iceServers?: FetchedIceServer[] }
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        const servers = flattenIceServers(data.iceServers)
        cachedIce = { servers, at: Date.now() }
        return servers
      }
    }
  } catch {
    // fall through to local defaults
  }
  return ICE_SERVERS
}

interface AvailableLanguage {
  targetId: string
  code: string
}

interface Listener {
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  alive: boolean
  id: string
  /** targetId the listener has selected, or null until selection arrives */
  selectedTargetId: string | null
}

const listeners = new Map<string, Listener>()
let pingInterval: ReturnType<typeof setInterval> | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let listenerIdCounter = 0
let availableLanguages: AvailableLanguage[] = []
let listenerCountsCallback: ((counts: Record<string, number>) => void) | null =
  null

function generateSecret(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export function getStreamSecret(): string {
  const saved = getSetting('app_settings', SETTINGS_KEY)
  if (saved) return saved.value
  const secret = generateSecret()
  upsertSetting('app_settings', { key: SETTINGS_KEY, value: secret })
  return secret
}

export function resetStreamSecret(): string {
  const secret = generateSecret()
  upsertSetting('app_settings', { key: SETTINGS_KEY, value: secret })
  for (const [id, listener] of listeners) {
    try {
      if (listener.dc?.readyState === 'open') {
        listener.dc.send(JSON.stringify({ type: 'secret_reset' }))
      }
      listener.pc.close()
    } catch {}
    listeners.delete(id)
  }
  notifyListenerCounts()
  logger.info('Stream secret reset, all listeners disconnected')
  if (pollInterval) {
    stopSignalingRelay()
    startSignalingRelay()
  }
  return secret
}

export function setAvailableLanguages(langs: AvailableLanguage[]): void {
  availableLanguages = langs
  // Notify connected listeners of the (possibly changed) list
  const payload = JSON.stringify({
    type: 'available_languages',
    languages: langs,
  })
  for (const listener of listeners.values()) {
    if (listener.dc?.readyState === 'open') {
      try {
        listener.dc.send(payload)
      } catch {}
    }
  }
}

export function setListenerCountsCallback(
  cb: (counts: Record<string, number>) => void,
): void {
  listenerCountsCallback = cb
}

function notifyListenerCounts(): void {
  if (!listenerCountsCallback) return
  const counts: Record<string, number> = {}
  for (const listener of listeners.values()) {
    if (listener.selectedTargetId) {
      counts[listener.selectedTargetId] =
        (counts[listener.selectedTargetId] || 0) + 1
    }
  }
  listenerCountsCallback(counts)
}

export async function startSignalingRelay(): Promise<void> {
  const secret = getStreamSecret()
  try {
    const res = await fetch(`${SIGNALING_BASE_URL}/signal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    })
    if (!res.ok) {
      logger.error('Failed to register room on CF Worker', {
        status: res.status,
      })
      return
    }
    logger.info('Room registered on CF Worker')
  } catch (err) {
    logger.error('Failed to reach CF Worker for registration', {
      error: String(err),
    })
    return
  }

  if (pollInterval) clearInterval(pollInterval)
  // Aggressive 500ms poll — every poll only fetches a small JSON, and faster
  // polling cuts up to 2s off first-connect latency for new listeners.
  pollInterval = setInterval(() => pollForOffers(secret), 500)
  logger.info('Signaling relay polling started')
}

export async function stopSignalingRelay(): Promise<void> {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  const secret = getStreamSecret()
  try {
    await fetch(`${SIGNALING_BASE_URL}/signal/unregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    })
    logger.info('Room unregistered from CF Worker')
  } catch {
    logger.warn('Failed to unregister room from CF Worker')
  }

  for (const [id] of listeners) {
    cleanupListener(id)
  }
}

async function pollForOffers(secret: string): Promise<void> {
  try {
    const res = await fetch(`${SIGNALING_BASE_URL}/signal/${secret}/offers`)
    if (!res.ok) return
    const data = (await res.json()) as {
      offers: Array<{ sessionId: string; offer: string }>
    }
    if (!data.offers || data.offers.length === 0) return
    logger.info('Received pending offers', { count: data.offers.length })

    for (const { sessionId, offer } of data.offers) {
      try {
        const result = await handleListenerOffer(offer)
        await fetch(`${SIGNALING_BASE_URL}/signal/${secret}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, answer: result.answer }),
        })
        logger.info('Answer sent for session', { sessionId })
      } catch (err) {
        logger.error('Failed to handle offer', {
          sessionId,
          error: String(err),
        })
      }
    }
  } catch (err) {
    logger.debug('Poll for offers failed', { error: String(err) })
  }
}

export async function handleListenerOffer(
  offerSdp: string,
): Promise<{ answer: string; listenerId: string }> {
  const listenerId = `listener-${++listenerIdCounter}`
  const iceServers = await getIceServers()
  const pc = new RTCPeerConnection({
    iceServers,
    bundlePolicy: 'max-bundle',
  })

  const listener: Listener = {
    pc,
    dc: null,
    alive: true,
    id: listenerId,
    selectedTargetId: null,
  }
  listeners.set(listenerId, listener)

  pc.onDataChannel.subscribe((dc) => {
    listener.dc = dc
    logger.info('Data channel opened for listener', { listenerId })

    // Send available languages so the listener UI can populate its picker
    try {
      dc.send(
        JSON.stringify({
          type: 'available_languages',
          languages: availableLanguages,
        }),
      )
    } catch {}

    dc.onMessage.subscribe((data) => {
      const text =
        typeof data === 'string' ? data : Buffer.from(data).toString('utf-8')
      try {
        const parsed = JSON.parse(text)
        if (parsed.type === 'pong') {
          listener.alive = true
        } else if (parsed.type === 'select_language') {
          const targetId = String(parsed.targetId || '')
          if (
            !targetId ||
            !availableLanguages.find((l) => l.targetId === targetId)
          ) {
            logger.warn('Listener requested unknown target', {
              listenerId,
              targetId,
            })
            return
          }
          listener.selectedTargetId = targetId
          logger.info('Listener selected language', { listenerId, targetId })
          notifyListenerCounts()
        }
      } catch {}
    })

    dc.stateChange.subscribe((state) => {
      if (state === 'closed') {
        logger.info('Data channel closed for listener', { listenerId })
        cleanupListener(listenerId)
      }
    })
  })

  pc.connectionStateChange.subscribe((state) => {
    logger.debug('Peer connection state', { listenerId, state })
    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      cleanupListener(listenerId)
    }
  })

  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)

  if (pc.iceGatheringState !== 'complete') {
    // 2.5s upper bound — STUN candidates almost always arrive in <500ms;
    // waiting 10s on a stale handshake just blocks the listener from
    // hearing audio. If gathering isn't done by then, ship the partial SDP.
    await pc.iceGatheringStateChange.watch(
      (state) => state === 'complete',
      2500,
    )
  }

  const localDesc = pc.localDescription
  if (!localDesc) {
    throw new Error('Failed to create local description')
  }

  logger.info('WebRTC answer created for listener', { listenerId })
  startKeepalive()

  return {
    answer: localDesc.sdp,
    listenerId,
  }
}

export function broadcastAudioForTarget(
  targetId: string,
  pcmBuffer: Buffer,
): void {
  if (listeners.size === 0) return
  const message = JSON.stringify({
    type: 'audio',
    targetId,
    data: pcmBuffer.toString('base64'),
  })
  for (const [id, listener] of listeners) {
    if (
      listener.selectedTargetId === targetId &&
      listener.dc?.readyState === 'open'
    ) {
      try {
        listener.dc.send(message)
      } catch {
        cleanupListener(id)
      }
    }
  }
}

/**
 * Broadcast a translated text snippet (the live transcript of the target
 * language) to every listener currently subscribed to that target. Carries
 * an entry id + action so the listener can replace the in-progress line
 * (action='update') or start a fresh one (action='add').
 */
export function broadcastTextForTarget(
  targetId: string,
  text: string,
  entryId: string,
  action: 'add' | 'update',
): void {
  if (listeners.size === 0 || !text) return
  const message = JSON.stringify({
    type: 'text',
    targetId,
    text,
    entryId,
    action,
  })
  for (const [id, listener] of listeners) {
    if (
      listener.selectedTargetId === targetId &&
      listener.dc?.readyState === 'open'
    ) {
      try {
        listener.dc.send(message)
      } catch {
        cleanupListener(id)
      }
    }
  }
}

export function getListenerCount(): number {
  return listeners.size
}

export function getListenerCountsByTarget(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const listener of listeners.values()) {
    if (listener.selectedTargetId) {
      counts[listener.selectedTargetId] =
        (counts[listener.selectedTargetId] || 0) + 1
    }
  }
  return counts
}

function cleanupListener(id: string): void {
  const listener = listeners.get(id)
  if (!listener) return
  try {
    listener.pc.close()
  } catch {}
  listeners.delete(id)
  logger.info('Listener cleaned up', { id, remaining: listeners.size })
  notifyListenerCounts()
  if (listeners.size === 0 && pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
}

function startKeepalive(): void {
  if (pingInterval) return
  pingInterval = setInterval(() => {
    for (const [id, listener] of listeners) {
      if (!listener.alive) {
        logger.debug('Removing dead listener', { id })
        cleanupListener(id)
        continue
      }
      listener.alive = false
      if (listener.dc?.readyState === 'open') {
        try {
          listener.dc.send(JSON.stringify({ type: 'ping' }))
        } catch {
          cleanupListener(id)
        }
      }
    }
    if (listeners.size === 0 && pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
  }, 15000)
}
