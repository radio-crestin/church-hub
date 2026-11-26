import { getSignalingRelayUrls } from './getSignalingRelayUrls'
import { log } from '../../utils/fileLogger'

const logger = {
  info: (msg: string, data?: unknown) => log('signaling', 'info', msg, data),
  warn: (msg: string, data?: unknown) => log('signaling', 'warn', msg, data),
  error: (msg: string, data?: unknown) => log('signaling', 'error', msg, data),
}

/** The relay forgets a room after an hour (ROOM_TTL): register again before. */
const REGISTER_EVERY_MS = 30 * 60 * 1000

interface SignalingRelayOptions {
  /** The room's id, shared with the devices that may connect. */
  secret: string
  /** The host key the room id comes from (hostedRoom.ts). */
  hostKey: string
  /** How often to look for new offers. */
  pollMs: number
  /** Answers a device's SDP offer with this computer's SDP answer. */
  answer: (offerSdp: string) => Promise<string>
}

/**
 * Keeps this computer's room open on every signaling relay it announces on
 * (getSignalingRelayUrls) and answers each device's WebRTC offer; returns the
 * function that closes the room everywhere.
 */
export function startSignalingRelay(
  options: SignalingRelayOptions,
): () => Promise<void> {
  const closers = getSignalingRelayUrls().map((base) =>
    openRoomOn(base, options),
  )
  return async () => {
    await Promise.all(closers.map((close) => close()))
  }
}

/** The room on one relay; returns the function that closes it there. */
function openRoomOn(
  base: string,
  { secret, hostKey, pollMs, answer }: SignalingRelayOptions,
): () => Promise<void> {
  const relay = new URL(base).host
  // Host calls carry the host key; listeners only ever hold the room id.
  const authorization = { authorization: `Bearer ${hostKey}` }
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authorization },
      body: JSON.stringify(body),
    })

  const register = async () => {
    try {
      const res = await post('/signal/register', { secret })
      if (!res.ok)
        logger.error('Room registration refused', {
          relay,
          status: res.status,
        })
    } catch (error) {
      logger.warn('Signaling relay unreachable', {
        relay,
        error: String(error),
      })
    }
  }

  let polling = false
  const poll = async () => {
    if (polling) return
    polling = true
    try {
      const res = await fetch(`${base}/signal/${secret}/offers`, {
        headers: authorization,
      })
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
      logger.warn('Polling for offers failed', {
        relay,
        error: String(error),
      })
    } finally {
      polling = false
    }
  }

  void register()
  const registerTimer = setInterval(register, REGISTER_EVERY_MS)
  const pollTimer = setInterval(poll, pollMs)
  logger.info('Signaling room open', { relay })

  return async () => {
    clearInterval(registerTimer)
    clearInterval(pollTimer)
    try {
      await post('/signal/unregister', { secret })
    } catch (error) {
      logger.warn('Room not closed on the relay', {
        relay,
        error: String(error),
      })
    }
    logger.info('Signaling room closed', { relay })
  }
}
