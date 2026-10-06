import { parseOpenSongXml } from '~/features/song-import'
import type { SongBundleFile } from './types'
import type { DiscoveryCandidate } from '../types'

/**
 * A song bundle's OpenSong files as discovery candidates, read by the same
 * parser the OpenSong import uses. A song keeps the file it first came from
 * (source_filename), so the library match by file name still finds it.
 */
export function bundleSongsToCandidates(
  sourceId: string,
  files: SongBundleFile[],
  /** Church Hub's own files keep their titles; others are cleaned up. */
  { exactTitle }: { exactTitle: boolean },
): DiscoveryCandidate[] {
  return files.map((file) => {
    const parsed = parseOpenSongXml(file.xml, file.path, { exactTitle })
    return {
      tempId: `${sourceId}-${file.id}`,
      sourceFilename: parsed.metadata?.sourceFilename ?? file.path,
      parsed,
    }
  })
}
