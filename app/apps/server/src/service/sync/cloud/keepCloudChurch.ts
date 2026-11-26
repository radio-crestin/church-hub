import { getCloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { disconnectCloudSync } from './disconnectCloudSync'
import { setServerConflict } from './serverConflict'
import { serviceError, syncServiceRequest } from './syncServiceRequest'
import { runSyncCycle } from '../runSyncCycle'

/**
 * Answers "which PC keeps the church?" after another PC turned up with the
 * same server token (a restored backup). `here`: this PC takes it over and
 * syncs on; the other one is refused from its next call. Otherwise this PC
 * lets go: it disconnects and the other one keeps the church.
 */
export async function keepCloudChurch(here: boolean): Promise<void> {
  const identity = await getCloudIdentity()
  if (!identity) throw new Error('not_connected')
  if (!here) {
    await disconnectCloudSync()
    setServerConflict(null)
    return
  }
  const response = await syncServiceRequest<{ readUrl: string }>(
    { serviceUrl: identity.serviceUrl, identity },
    'POST',
    '/takeover',
  )
  if (response.status !== 200) throw serviceError(response)
  setServerConflict(null)
  if (response.body.readUrl !== identity.readUrl) {
    await updateCloudIdentity({
      readUrl: response.body.readUrl,
      headEtag: null,
    })
  }
  void runSyncCycle()
}
