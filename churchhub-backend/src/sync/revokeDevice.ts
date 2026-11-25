import { rotatePath } from './rotatePath'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { updateChurch } from './state/updateChurch'
import { SyncError } from './SyncError'

/**
 * Revokes a device: its writes are refused from the next request, and the
 * path secret rotates, since the device still knows the old read path.
 * The church server's own token is not revoked this way (T-172: recovery).
 * Returns the state after the rotation.
 */
export async function revokeDevice(
  store: SyncStore,
  churchId: string,
  deviceId: string
): Promise<ChurchState> {
  await updateChurch(store, churchId, async (church) => {
    const device = church.devices.find(
      (candidate) => candidate.id === deviceId && candidate.revokedAt === null
    )
    if (!device) throw new SyncError(404, 'not_found', 'No such device')
    if (device.isServer) {
      throw new SyncError(
        400,
        'server_device',
        'The church server cannot be revoked'
      )
    }
    device.revokedAt = Math.floor(Date.now() / 1000)
    return { next: church, result: device.id }
  })
  return rotatePath(store, churchId)
}
