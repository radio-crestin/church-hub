import { bundleFilesToSongs, readSongBundleZip } from '@church-hub/song-formats'

import { sourceSongsToCandidates } from './sourceSongsToCandidates'
import type { FetchCatalog } from './types'
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
    return sourceSongsToCandidates(
      source.id,
      bundleFilesToSongs(files, { exactTitle: true }),
    )
  }
  const archive = await downloadSourceArchive(source.id, report)
  const { files, ownFormat } = await readSongBundleZip(archive)
  onProgress?.({ phase: 'parsing', current: 0, total: files.length })
  return sourceSongsToCandidates(
    source.id,
    bundleFilesToSongs(files, { exactTitle: ownFormat }),
  )
}
