import { getCloudIdentity } from './cloudIdentityStore'
import { runCloudSyncCycle } from './runCloudSyncCycle'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('sync')

/**
 * After a user was deactivated or removed: the change goes out at once, and
 * the sync service, applying it, signs out their devices and moves the
 * read path. A failure is logged, not thrown: the user change stands, and
 * the next sync cycle sends it again.
 */
export async function signOutUserDevices(): Promise<void> {
  if (!(await getCloudIdentity())) return
  const result = await runCloudSyncCycle()
  if (!result.success) {
    logger.error(`Publishing a user's sign-out failed: ${result.error}`)
  }
}
