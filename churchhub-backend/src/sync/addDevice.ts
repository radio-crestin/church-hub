import { createDeviceToken } from './createDeviceToken'
import { randomId } from './randomId'
import type { SyncStore } from './state/ChurchState'
import { updateChurch } from './state/updateChurch'
import { SyncError } from './SyncError'

/**
 * Mints a device token bound to one of the church's users, so that user's
 * permissions apply to everything the device writes. The token is returned
 * once; only its hash is kept.
 */
export async function addDevice(
  store: SyncStore,
  churchId: string,
  input: { userId: string; name: string }
): Promise<{ deviceId: string; token: string }> {
  const deviceId = randomId(12)
  const { token, tokenHash } = await createDeviceToken(store.secret)
  await updateChurch(store, churchId, async (church) => {
    if (!church.users.some((user) => user.id === input.userId)) {
      throw new SyncError(400, 'unknown_user', 'No such user in this church')
    }
    church.devices.push({
      id: deviceId,
      tokenHash,
      userId: input.userId,
      name: input.name,
      isServer: false,
      createdAt: Math.floor(Date.now() / 1000),
      revokedAt: null,
    })
    return { next: church, result: deviceId }
  })
  return { deviceId, token }
}
