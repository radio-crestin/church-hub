import { libraryRequest } from './libraryRequest'
import { requireCloudIdentity } from './requireCloudIdentity'
import { deleteShareRow, getShare } from './shareStore'

/**
 * Stops a share: the service takes its library out of the catalog and the
 * bucket, then the share is forgotten here. Churches that added it keep the
 * songs they imported.
 */
export async function deleteShare(id: number): Promise<void> {
  const share = getShare(id)
  if (!share) return
  if (share.manifestUrl) {
    const identity = await requireCloudIdentity()
    await libraryRequest(identity, 'DELETE', share.sourceId)
  }
  deleteShareRow(share.id)
}
