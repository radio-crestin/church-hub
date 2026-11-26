import { getCloudIdentity } from './cloudIdentityStore'
import { idByUuid } from '../records/idByUuid'

/** The sync service answers a token check well within this. */
const TIMEOUT_MS = 15_000

/**
 * The user (this server's id) a joined phone's device token writes as
 * (T-168), asked of the sync service with that token: null for a token it
 * refuses (revoked, another church's, made up), the church server's own, or
 * a user this server doesn't have. The service is the authority on tokens,
 * so a device revoked from a phone is refused here too.
 */
export async function identifyCloudDevice(
  deviceToken: string,
): Promise<number | null> {
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
  const { userId } = (await response.json()) as { userId: string | null }
  return userId === null ? null : idByUuid('users', userId)
}
