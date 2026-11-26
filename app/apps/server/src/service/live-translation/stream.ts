import { type RTCDataChannel, RTCPeerConnection } from 'werift'

import { getStreamRooms, renewStreamLink } from './streamLink'
import { log } from '../../utils/fileLogger'
import { ICE_SERVERS } from '../signaling/iceServers'
import { startSignalingRelay } from '../signaling/startSignalingRelay'

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
let closeRooms: Array<() => Promise<void>> = []
let roomsOpen = false
let listenerIdCounter = 0
let availableLanguages: AvailableLanguage[] = []
let listenerCountsCallback: ((counts: Record<string, number>) => void) | null =
  null

export function resetStreamSecret(): string {
  const secret = renewStreamLink()
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
  if (roomsOpen) void openListenerRoom()
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

async function closeRoomsOnRelay(): Promise<void> {
  const closing = closeRooms
  closeRooms = []
  await Promise.all(closing.map((close) => close()))
}

/**
 * Opens (or reopens, after a new link) the listeners' rooms on the
 * signaling relay, the current link's and the old one's while it is served,
 * and answers each listener's offer.
 */
export async function openListenerRoom(): Promise<void> {
  roomsOpen = true
  await closeRoomsOnRelay()
  closeRooms = getStreamRooms().map(({ secret, hostKey }) =>
    startSignalingRelay({
      secret,
      hostKey,
      // Every poll fetches a small JSON; polling fast cuts up to 2 s off a
      // new listener's first connect.
      pollMs: 500,
      answer: async (offer) => (await handleListenerOffer(offer)).answer,
    }),
  )
}

/** Closes the listeners' rooms and disconnects every listener. */
export async function closeListenerRoom(): Promise<void> {
  roomsOpen = false
  await closeRoomsOnRelay()
  for (const [id] of listeners) {
    cleanupListener(id)
  }
}

export async function handleListenerOffer(
  offerSdp: string,
): Promise<{ answer: string; listenerId: string }> {
  const listenerId = `listener-${++listenerIdCounter}`
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
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
