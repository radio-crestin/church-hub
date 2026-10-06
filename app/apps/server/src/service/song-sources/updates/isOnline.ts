import { createLogger } from '../../../utils/logger'

const logger = createLogger('song-updates')

/** Where the built-in song sources live; another URL only for testing. */
const PROBE_URL =
  process.env.CHURCH_HUB_ONLINE_PROBE_URL ?? 'https://github.com'
const PROBE_TIMEOUT_MS = 5000

/** Whether the internet answers, asked quickly. */
export async function isOnline(): Promise<boolean> {
  try {
    await fetch(PROBE_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return true
  } catch (error) {
    logger.debug(`No answer from ${PROBE_URL}: ${error}`)
    return false
  }
}
