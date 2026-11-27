import { getCloudIdentity } from '../sync/cloud/cloudIdentityStore'
import { getSyncServiceUrl } from '../sync/cloud/getSyncServiceUrl'

/** The sync service the library is on: the church's own, else the default. */
export async function getLibraryServiceUrl(): Promise<string> {
  return (await getCloudIdentity())?.serviceUrl ?? getSyncServiceUrl()
}
