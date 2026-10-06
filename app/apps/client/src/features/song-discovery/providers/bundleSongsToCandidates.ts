import { parseOpenSongXml } from '~/features/song-import'
import type { SongBundleFile } from './types'
import type { DiscoveryCandidate } from '../types'

/**
 * A song bundle's OpenSong files as discovery candidates, read by the same
 * parser the OpenSong import uses. A song keeps the file it first came from
 * (source_filename), so the library match by file name still finds it.
 * A file that is not valid OpenSong is left out (and logged), so one broken
 * song never hides the rest of a source.
 */
export function bundleSongsToCandidates(
  sourceId: string,
  files: SongBundleFile[],
  /** Church Hub's own files keep their titles; others are cleaned up. */
  { exactTitle }: { exactTitle: boolean },
): DiscoveryCandidate[] {
  const unreadable: string[] = []
  const candidates = files.flatMap((file) => {
    try {
      const parsed = parseOpenSongXml(file.xml, file.path, { exactTitle })
      return [
        {
          tempId: `${sourceId}-${file.id}`,
          sourceFilename: parsed.metadata?.sourceFilename ?? file.path,
          parsed,
        },
      ]
    } catch (error) {
      unreadable.push(`${file.path}: ${String(error).slice(0, 120)}`)
      return []
    }
  })
  if (unreadable.length > 0) {
    // biome-ignore lint/suspicious/noConsole: a source's broken songs are skipped
    console.warn(
      `[song-discovery] ${sourceId}: skipped ${unreadable.length} unreadable song(s)`,
      unreadable.slice(0, 5),
    )
  }
  return candidates
}
