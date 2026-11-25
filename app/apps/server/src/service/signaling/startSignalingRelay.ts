import { getSignalingBaseUrl } from './signalingBaseUrl'
import { log } from '../../utils/fileLogger'

const logger = {
  info: (msg: string, data?: unknown) => log('signaling', 'info', msg, data),
  warn: (msg: string, data?: unknown) => log('signaling', 'warn', msg, data),
  error: (msg: string, data?: unknown) => log('signaling', 'error', msg, data),
}

/** The relay forgets a room after an hour (ROOM_TTL): register again before. */
const REGISTER_EVERY_MS = 30 * 60 * 1000

interface SignalingRelayOptions {
  /** The room's secret, shared with the devices that may connect. */
  secret: string
  /** How often to look for new offers. */
  pollMs: number
  /** Answers a device's SDP offer with this computer's SDP answer. */
  answer: (offerSdp: string) => Promise<string>
}

/**
 * Keeps this computer's room open on the signaling relay and answers each
 * device's WebRTC offer; returns the function that closes the room.
 */
export function startSignalingRelay({
  secret,
  pollMs,
  answer,
}: SignalingRelayOptions): () => Promise<void> {
  const base = getSignalingBaseUrl()
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  const register = async () => {
    try {
      const res = await post('/signal/register', { secret })
      if (!res.ok)
        logger.error('Room registration refused', { status: res.status })
    } catch (error) {
      logger.warn('Signaling relay unreachable', { error: String(error) })
    }
  }

  let polling = false
  const poll = async () => {
    if (polling) return
    polling = true
    try {
      const res = await fetch(`${base}/signal/${secret}/offers`)
      if (!res.ok) return
      const { offers } = (await res.json()) as {
        offers: Array<{ sessionId: string; offer: string }>
      }
      for (const { sessionId, offer } of offers ?? []) {
        try {
          await post(`/signal/${secret}/answer`, {
            sessionId,
            answer: await answer(offer),
          })
        } catch (error) {
          logger.error('Offer not answered', {
            sessionId,
            error: String(error),
          })
        }
      }
    } catch (error) {
      logger.warn('Polling for offers failed', { error: String(error) })
    } finally {
      polling = false
    }
  }

  void register()
  const registerTimer = setInterval(register, REGISTER_EVERY_MS)
  const pollTimer = setInterval(poll, pollMs)
  logger.info('Signaling room open')

  return async () => {
    clearInterval(registerTimer)
    clearInterval(pollTimer)
    try {
      await post('/signal/unregister', { secret })
    } catch (error) {
      logger.warn('Room not closed on the relay', { error: String(error) })
    }
    logger.info('Signaling room closed')
  }
}
