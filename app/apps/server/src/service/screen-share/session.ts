import { closeMjpegStreams, publishFrame } from './mjpeg-stream'
import { createLogger } from '../../utils/logger'

const logger = createLogger('screen-share')

/** No frame for this long: the sharer is gone (app closed, network lost). */
export const STALE_AFTER_MS = 15_000
const STALE_CHECK_MS = 2_000

interface Session {
  token: string
  startedAt: number
  lastFrameAt: number
  watchdog: ReturnType<typeof setInterval>
}

let session: Session | null = null

export function isScreenShareActive() {
  return session !== null
}

/**
 * Starts a share (replacing any running one) and returns the ingest token the
 * sharer sends its frames with. `onStale` runs if the frames stop coming.
 */
export function startScreenShareSession(onStale: () => void): string {
  endScreenShareSession()
  const now = Date.now()
  const watchdog = setInterval(() => {
    if (session && Date.now() - session.lastFrameAt > STALE_AFTER_MS) {
      logger.warning('No frames for a while: ending the share')
      endScreenShareSession()
      onStale()
    }
  }, STALE_CHECK_MS)
  session = {
    token: crypto.randomUUID(),
    startedAt: now,
    lastFrameAt: now,
    watchdog,
  }
  logger.info('Screen share started')
  return session.token
}

/** Ends the share, if any, closing every viewer's stream. */
export function endScreenShareSession(): boolean {
  if (!session) return false
  clearInterval(session.watchdog)
  session = null
  closeMjpegStreams()
  logger.info('Screen share ended')
  return true
}

export type FrameResult = 'accepted' | 'no_session' | 'bad_token'

export function acceptFrame(
  token: string | null,
  jpeg: Uint8Array,
): FrameResult {
  if (!session) return 'no_session'
  if (token !== session.token) return 'bad_token'
  session.lastFrameAt = Date.now()
  publishFrame(jpeg)
  logger.trace(`Frame of ${jpeg.byteLength} bytes`)
  return 'accepted'
}
