import { bundleSongsToCandidates } from './bundleSongsToCandidates'
import { fetchCantariCrestineCatalog } from './fetchCantariCrestineCatalog'
import { fetchOpenSongZipCatalog } from './fetchOpenSongZipCatalog'
import { fetchSongBundleCatalog } from './fetchSongBundleCatalog'
import type {
  FetchCatalog,
  SongBundleFile,
  SongSource,
  SongSourceFormat,
} from './types'
import { getOpenedSongFiles } from '../opened-files/openedSongFiles'

/** How each source format's catalog is downloaded and parsed. */
const FETCHERS: Record<SongSourceFormat, FetchCatalog> = {
  'opensong-zip': fetchOpenSongZipCatalog,
  'cantaricrestine-api': fetchCantariCrestineCatalog,
  'song-bundle-file': fetchSongBundleCatalog,
  'song-bundle-folder': fetchSongBundleCatalog,
}

/** Downloads and parses a source's catalog; an opened file is in memory. */
export const fetchSourceCatalog: FetchCatalog = async (source, onProgress) =>
  source.origin === 'file'
    ? bundleSongsToCandidates(source.id, getOpenedSongFiles(source.id))
    : FETCHERS[source.format](source, onProgress)

export type { SongBundleFile, SongSource, SongSourceFormat }
