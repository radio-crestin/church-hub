import { identifyCloudDevice } from './identifyCloudDevice'
import { log } from '../../../utils/fileLogger'
import { toErrorMessage } from '../../../utils/toErrorMessage'

const logger = {
  info: (msg: string, data?: unknown) => log('auth', 'info', msg, data),
  warn: (msg: string, data?: unknown) => log('auth', 'warn', msg, data),
}

/** A session asks the sync service again, at most this often. */
const RECHECK_MS = 30_000
/** The service unreachable, a session lives on this long after its check. */
const OFFLINE_GRACE_MS = 10 * 60_000
/** Marks a session token, so other tokens skip the lookup. */
const PREFIX = 'dev_'

interface DeviceSession {
  deviceId: string
  userId: number
  /** Kept in memory only, to ask the service whether it still stands. */
  deviceToken: string
  checkedAt: number
  check?: Promise<number | null>
}

/** By their session token (in memory only). */
const sessions = new Map<string, DeviceSession>()

/**
 * Opens a session for a joined phone signed in with its device token
 * (T-174): its own token, never the user's, so revoking the device ends
 * it. Sessions live in memory: after a restart the phone signs in again.
 */
export function openDeviceSession(
  owner: { deviceId: string; userId: number },
  deviceToken: string,
): string {
  const token = `${PREFIX}${crypto.randomUUID()}${crypto.randomUUID()}`
  sessions.set(token, { ...owner, deviceToken, checkedAt: Date.now() })
  return token
}

/** Asks the service whether the device still stands; its user, or null. */
async function recheck(key: string, session: DeviceSession) {
  try {
    const owner = await identifyCloudDevice(session.deviceToken)
    if (!owner || owner.deviceId !== session.deviceId) {
      sessions.delete(key)
      logger.info('Device session ended: the device was revoked', {
        deviceId: session.deviceId,
      })
      return null
    }
    session.checkedAt = Date.now()
    return session.userId
  } catch (error) {
    const stale = Date.now() - session.checkedAt > OFFLINE_GRACE_MS
    logger.warn('Device session not checked: sync service unreachable', {
      error: toErrorMessage(error),
      stale,
    })
    if (stale) sessions.delete(key)
    return stale ? null : session.userId
  } finally {
    session.check = undefined
  }
}

/**
 * The user behind a device session token, or null when it isn't one or its
 * device was revoked (checked with the sync service every 30 s).
 */
export async function deviceSessionUserId(
  token: string,
): Promise<number | null> {
  if (!token.startsWith(PREFIX)) return null
  const session = sessions.get(token)
  if (!session) return null
  if (Date.now() - session.checkedAt < RECHECK_MS) return session.userId
  session.check ??= recheck(token, session)
  return session.check
}

/** Ends a revoked device's sessions at once (revoked from this PC). */
export function closeDeviceSessions(deviceId: string) {
  for (const [key, session] of sessions) {
    if (session.deviceId === deviceId) sessions.delete(key)
  }
}
