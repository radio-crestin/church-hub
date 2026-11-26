import { getCloudIdentity } from './cloudIdentityStore'
import { idByUuid } from '../records/idByUuid'

/** The sync service answers a token check well within this. */
const TIMEOUT_MS = 15_000

/** A joined phone's device on the sync service, and its user here. */
export interface CloudDeviceOwner {
  deviceId: string
  userId: number
}

/**
 * The device and user (this server's id) behind a joined phone's device
 * token (T-168), asked of the sync service with that token: null for a
 * token it refuses (revoked, another church's, made up), the church
 * server's own, or a user this server doesn't have. The service is the
 * authority on tokens, so a device revoked from a phone is refused here too.
 * Throws when the service can't be asked.
 */
export async function identifyCloudDevice(
  deviceToken: string,
): Promise<CloudDeviceOwner | null> {
  const identity = await getCloudIdentity()
  if (!identity) return null
  const base = identity.serviceUrl.replace(/\/+$/, '')
  const response = await fetch(
    `${base}/sync/churches/${encodeURIComponent(identity.churchId)}/device`,
    {
      headers: { Authorization: `Bearer ${deviceToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  )
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Sync service ${response.status}`)
  const { deviceId, userId } = (await response.json()) as {
    deviceId: string
    userId: string | null
  }
  const localId = userId === null ? null : idByUuid('users', userId)
  return localId === null ? null : { deviceId, userId: localId }
}
