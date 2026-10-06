import { bundleSongsToCandidates } from './bundleSongsToCandidates'
import type { FetchCatalog } from './types'
import { readSongBundleFile } from '../opened-files/readSongBundleFile'
import {
  downloadSourceArchive,
  getSourceSongs,
} from '../service/songSourcesApi'

/**
 * A song bundle source: a `.chsongs` file (downloaded through the server,
 * unzipped here like an opened file) or a shared S3 folder (read by the
 * server, which downloads only the songs that changed).
 */
export const fetchSongBundleCatalog: FetchCatalog = async (
  source,
  onProgress,
) => {
  const report = (current: number, total: number | null) =>
    onProgress?.({
      phase: 'downloading',
      current,
      total,
      currentFile: source.name,
    })

  report(0, null)
  if (source.format === 'song-bundle-folder') {
    const files = await getSourceSongs(source.id)
    return bundleSongsToCandidates(source.id, files, { exactTitle: true })
  }
  const archive = await downloadSourceArchive(source.id, report)
  const { files, ownFormat } = await readSongBundleFile(archive)
  onProgress?.({ phase: 'parsing', current: 0, total: files.length })
  return bundleSongsToCandidates(source.id, files, { exactTitle: ownFormat })
}
