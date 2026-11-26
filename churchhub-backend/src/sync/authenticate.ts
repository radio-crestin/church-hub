import { hashToken } from './hashToken'
import type { SyncStore } from './state/ChurchState'
import type { ChurchVersion } from './state/readChurch'
import { SyncError } from './SyncError'
import type { SyncCaller } from './types'

/**
 * Finds the device behind a `Bearer` token in the church's state. A revoked
 * device, another church's token, an unknown church or no token at all are
 * refused alike (401). The church server (the PC) has no user of its own:
 * each change it sends names its author (checkChanges).
 */
export async function authenticate(
  store: SyncStore,
  church: ChurchVersion | null,
  authorization: string | undefined
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
    userId: device.isServer ? null : device.userId,
  }
}
