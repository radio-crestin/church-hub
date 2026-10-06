import { bundleSongsToCandidates } from './bundleSongsToCandidates'
import type { FetchCatalog } from './types'
import { getSourceSongs } from '../service/songSourcesApi'

/**
 * A song bundle source (a `.chsongs` file or a shared S3 folder), read by
 * the server: for a folder it downloads only the songs that changed.
 */
export const fetchSongBundleCatalog: FetchCatalog = async (
  source,
  onProgress,
) => {
  onProgress?.({
    phase: 'downloading',
    current: 0,
    total: null,
    currentFile: source.name,
  })
  return bundleSongsToCandidates(source.id, await getSourceSongs(source.id))
}
