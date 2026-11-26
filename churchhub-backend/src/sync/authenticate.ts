import { hashToken } from './hashToken'
import type { SyncStore } from './state/ChurchState'
import type { ChurchVersion } from './state/readChurch'
import { SyncError } from './SyncError'
import type { SyncCaller } from './types'

/**
 * Finds the device behind a `Bearer` token in the church's state. A revoked
 * device, another church's token, an unknown church or no token at all are
 * refused alike (401). The church server (the PC) may name the user a
 * change was made by (`actingUserId`): it already logged that user in, and
 * the check then applies to them.
 */
export async function authenticate(
  store: SyncStore,
  church: ChurchVersion | null,
  authorization: string | undefined,
  actingUserId?: string | null
): Promise<SyncCaller> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) throw new SyncError(401, 'unauthorized', 'Missing token')
  const tokenHash = await hashToken(token, store.secret)
  const device = church?.state.devices.find(
    (candidate) =>
      candidate.tokenHash === tokenHash && candidate.revokedAt === null
  )
  if (!church || !device) {
    throw new SyncError(401, 'unauthorized', 'Invalid token')
  }

  return {
    churchId: church.state.id,
    deviceId: device.id,
    isServer: device.isServer,
    userId: device.isServer ? (actingUserId ?? null) : device.userId,
  }
}
