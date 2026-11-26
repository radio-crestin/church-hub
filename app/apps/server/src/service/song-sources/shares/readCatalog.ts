import { getSyncServiceUrl } from '../../sync/cloud/getSyncServiceUrl'
import {
  serviceError,
  syncServiceRequest,
} from '../../sync/cloud/syncServiceRequest'
import { DownloadError } from '../links/DownloadError'
import { fetchLink } from '../links/fetchLink'

/** A listed shared library, as the catalog shows it. */
export interface CatalogLibrary {
  sourceId: string
  name: string
  publisher: string
  songCount: number
  updatedAt: string
  /** What to add as a song source. */
  manifestUrl: string
}

/**
 * The libraries churches listed in the public catalog
 * (`libraries/catalog.json`, read straight from the bucket). Empty before
 * anyone lists one.
 */
export async function readCatalog(): Promise<CatalogLibrary[]> {
  const located = await syncServiceRequest<{ catalogUrl: string }>(
    { serviceUrl: getSyncServiceUrl() },
    'GET',
    '/libraries',
  )
  if (located.status !== 200) throw serviceError(located)
  const { catalogUrl } = located.body
  let bytes: Uint8Array
  try {
    bytes = await fetchLink(catalogUrl)
  } catch (error) {
    // No catalog yet: a bucket without listing answers 403 for a missing key.
    if (error instanceof DownloadError && /^40[34]/.test(error.status))
      return []
    throw error
  }
  const catalog = JSON.parse(new TextDecoder().decode(bytes)) as {
    format?: string
    libraries?: Omit<CatalogLibrary, 'manifestUrl'>[]
  }
  if (catalog.format !== 'church-hub-library-catalog') return []
  return (catalog.libraries ?? []).map((library) => ({
    ...library,
    manifestUrl: new URL(
      `${encodeURIComponent(library.sourceId)}/manifest.json`,
      catalogUrl,
    ).toString(),
  }))
}
