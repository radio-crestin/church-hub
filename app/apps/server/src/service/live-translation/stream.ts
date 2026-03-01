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

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

interface Listener {
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  alive: boolean
  id: string
}

const listeners = new Map<string, Listener>()
let pingInterval: ReturnType<typeof setInterval> | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let listenerIdCounter = 0

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
  // Close all existing peer connections
  for (const [id, listener] of listeners) {
    try {
      if (listener.dc?.readyState === 'open') {
        listener.dc.send(JSON.stringify({ type: 'secret_reset' }))
      }
      listener.pc.close()
    } catch {}
    listeners.delete(id)
  }
  logger.info('Stream secret reset, all listeners disconnected')
  // Re-register with new secret if relay was active
  if (pollInterval) {
    stopSignalingRelay()
    startSignalingRelay()
  }
  return secret
}

/**
 * Register the room on the CF Worker and start polling for SDP offers.
 */
export async function startSignalingRelay(): Promise<void> {
  const secret = getStreamSecret()

  // Register room on CF Worker
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

  // Start polling for offers
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(() => pollForOffers(secret), 2000)
  logger.info('Signaling relay polling started')
}

/**
 * Stop polling and unregister the room.
 */
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

  // Close all peer connections
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
        // Post the answer back to CF Worker
        await fetch(`${SIGNALING_BASE_URL}/signal/${secret}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            answer: result.answer,
          }),
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

/**
 * Handle a WebRTC offer from a listener browser.
 * Creates a server-side peer connection, sets up a data channel for audio,
 * and returns the SDP answer.
 */
export async function handleListenerOffer(
  offerSdp: string,
): Promise<{ answer: string; listenerId: string }> {
  const listenerId = `listener-${++listenerIdCounter}`

  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    bundlePolicy: 'max-bundle',
  })

  const listener: Listener = { pc, dc: null, alive: true, id: listenerId }
  listeners.set(listenerId, listener)

  // When the browser-created data channel arrives on our side
  pc.onDataChannel.subscribe((dc) => {
    listener.dc = dc
    logger.info('Data channel opened for listener', { listenerId })

    dc.onMessage.subscribe((data) => {
      const msg =
        typeof data === 'string' ? data : Buffer.from(data).toString('utf-8')
      try {
        const parsed = JSON.parse(msg)
        if (parsed.type === 'pong') {
          listener.alive = true
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

  // Set the remote offer from the browser
  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })

  // Create answer
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)

  // Wait for ICE gathering to complete so we return a complete SDP
  if (pc.iceGatheringState !== 'complete') {
    await pc.iceGatheringStateChange.watch(
      (state) => state === 'complete',
      10000,
    )
  }

  const localDesc = pc.localDescription
  if (!localDesc) {
    throw new Error('Failed to create local description')
  }

  logger.info('WebRTC answer created for listener', { listenerId })

  // Start keepalive if first listener
  startKeepalive()

  return {
    answer: localDesc.sdp,
    listenerId,
  }
}

/**
 * Broadcast translated audio PCM (24kHz 16-bit mono) to all connected listeners
 * via WebRTC data channels.
 */
export function broadcastAudioToListeners(pcmBuffer: Buffer): void {
  if (listeners.size === 0) return

  const message = JSON.stringify({
    type: 'audio',
    data: pcmBuffer.toString('base64'),
  })

  for (const [id, listener] of listeners) {
    if (listener.dc?.readyState === 'open') {
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

function cleanupListener(id: string): void {
  const listener = listeners.get(id)
  if (!listener) return

  try {
    listener.pc.close()
  } catch {}
  listeners.delete(id)
  logger.info('Listener cleaned up', { id, remaining: listeners.size })

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
