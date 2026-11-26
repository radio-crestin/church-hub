import { listCloudDevices, revokeCloudDevice } from './cloudDevices'
import { getCloudIdentity } from './cloudIdentityStore'
import { pushAccessIfChanged } from './pushAccessIfChanged'
import { createLogger } from '../../../utils/logger'
import { toErrorMessage } from '../../../utils/toErrorMessage'

const logger = createLogger('sync')

async function signOut(userId: number): Promise<void> {
  const identity = await getCloudIdentity()
  if (!identity) return
  const pushed = await pushAccessIfChanged(identity)
  if (pushed?.revokesDevicesWithUser) return

  const devices = await listCloudDevices()
  for (const device of devices) {
    if (device.userId === userId && device.revokedAt === null) {
      await revokeCloudDevice(device.id)
    }
  }
}

/**
 * After a user was deactivated or removed: their devices are signed out on
 * the sync service. The access push does it (the service revokes them and
 * moves the read path); an older service, or a push a sync cycle already
 * made, leaves the ones still active to revoke here one by one. Callers
 * don't wait for it: while the library uploads, the service takes seconds
 * to apply the access. A failure is logged, not thrown: the user change
 * stands, and the next sync cycle pushes the access again.
 */
export async function signOutUserDevices(userId: number): Promise<void> {
  try {
    await signOut(userId)
  } catch (error) {
    logger.error(
      `Signing out user ${userId}'s devices failed: ${toErrorMessage(error)}`,
    )
  }
}
