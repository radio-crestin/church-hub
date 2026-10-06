import { fetchCantariCrestineCatalog } from './fetchCantariCrestineCatalog'
import { fetchOpenSongZipCatalog } from './fetchOpenSongZipCatalog'
import type { FetchCatalog, SongSource, SongSourceFormat } from './types'

/** How each source format's catalog is downloaded and parsed. */
const FETCHERS: Partial<Record<SongSourceFormat, FetchCatalog>> = {
  'opensong-zip': fetchOpenSongZipCatalog,
  'cantaricrestine-api': fetchCantariCrestineCatalog,
}

/** Downloads and parses a source's catalog, by its format. */
export const fetchSourceCatalog: FetchCatalog = (source, onProgress) => {
  const fetchCatalog = FETCHERS[source.format]
  if (!fetchCatalog) {
    throw new Error(`Unsupported song source format: ${source.format}`)
  }
  return fetchCatalog(source, onProgress)
}

export type { SongSource, SongSourceFormat }
