import { getLibraryServiceUrl } from './getLibraryServiceUrl'
import { requireCuratorTicket } from './requireCuratorTicket'
import {
  type FeaturedSource,
  refreshFeaturedSources,
} from '../song-sources/featured'
import {
  serviceError,
  syncServiceRequest,
} from '../sync/cloud/syncServiceRequest'

/**
 * Publishes the sources every app is offered (a curator's edit), then
 * reads the list back so this app shows it at once.
 */
export async function saveFeaturedSources(
  sources: FeaturedSource[],
): Promise<void> {
  const response = await syncServiceRequest(
    {
      serviceUrl: await getLibraryServiceUrl(),
      ownerTicket: requireCuratorTicket(),
    },
    'PUT',
    '/featured-sources',
    { sources },
  )
  if (response.status >= 400) throw serviceError(response)
  await refreshFeaturedSources()
}
