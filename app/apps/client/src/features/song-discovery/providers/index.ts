import { bundleSongsToCandidates } from './bundleSongsToCandidates'
import { fetchCantariCrestineCatalog } from './fetchCantariCrestineCatalog'
import { fetchSongBundleCatalog } from './fetchSongBundleCatalog'
import type {
  FetchCatalog,
  SongBundleFile,
  SongSource,
  SongSourceFormat,
} from './types'
import { getOpenedSongFile } from '../opened-files/openedSongFiles'

/** How each source format's catalog is downloaded and parsed. */
const FETCHERS: Record<SongSourceFormat, FetchCatalog> = {
  'cantaricrestine-api': fetchCantariCrestineCatalog,
  'song-bundle-file': fetchSongBundleCatalog,
  'song-bundle-folder': fetchSongBundleCatalog,
}

/** Downloads and parses a source's catalog; an opened file is in memory. */
export const fetchSourceCatalog: FetchCatalog = async (source, onProgress) => {
  if (source.origin !== 'file')
    return FETCHERS[source.format](source, onProgress)
  const { files, ownFormat } = getOpenedSongFile(source.id)
  return bundleSongsToCandidates(source.id, files, { exactTitle: ownFormat })
}

export type { SongBundleFile, SongSource, SongSourceFormat }
