import { listCloudDevices, revokeCloudDevice } from './cloudDevices'
import { getCloudIdentity } from './cloudIdentityStore'
import { createLogger } from '../../../utils/logger'
import { toErrorMessage } from '../../../utils/toErrorMessage'
import { runSyncCycle } from '../runSyncCycle'
import { getSyncConfig } from '../syncConfigStore'

const logger = createLogger('sync')

async function signOut(userId: number): Promise<void> {
  if (!(await getCloudIdentity())) return
  const config = await getSyncConfig()
  if (config.syncEnabled && config.transport === 'cloud') {
    const result = await runSyncCycle({ waitsItsTurn: true })
    if (!result.success) throw new Error(result.error ?? 'sync failed')
    return
  }
  // Sync is paused: nothing else goes out, but the devices still go.
  for (const device of await listCloudDevices()) {
    if (device.userId === userId && device.revokedAt === null) {
      await revokeCloudDevice(device.id)
    }
  }
}

/**
 * After a user was deactivated or removed: their devices are signed out on
 * the sync service. The user change goes out at once, and the service,
 * applying it, revokes them and moves the read path; while sync is paused,
 * each of their devices is revoked by itself. Callers don't wait for it:
 * while the library uploads, the service takes seconds to apply the change.
 * A failure is logged, not thrown: the user change stands, and the next sync
 * cycle sends it again.
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
