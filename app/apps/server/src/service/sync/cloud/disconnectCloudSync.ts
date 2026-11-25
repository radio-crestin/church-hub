import { clearCloudIdentity } from './cloudIdentityStore'
import { upsertSyncConfig } from '../syncConfigStore'

/**
 * Stops syncing with the cloud: forgets the church and its versions, and
 * goes back to the Drive transport, disabled until turned on again. The
 * church's data stays on the service (T-172: recovery by its owner).
 */
export async function disconnectCloudSync(): Promise<void> {
  await clearCloudIdentity()
  await upsertSyncConfig({
    transport: 'drive',
    syncEnabled: false,
    lastError: null,
  })
}
