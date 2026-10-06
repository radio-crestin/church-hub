import { parseOpenSongXml } from './parseOpenSongXml'
import type { SongBundleFile, SourceSong } from './sourceSongTypes'

/**
 * A song bundle's OpenSong files as songs. A song keeps the file it first
 * came from (source_filename), so the library match by file name finds it.
 */
export function bundleFilesToSongs(
  files: SongBundleFile[],
  /** Church Hub's own files keep their titles; others are cleaned up. */
  { exactTitle }: { exactTitle: boolean },
): SourceSong[] {
  return files.map((file) => {
    const parsed = parseOpenSongXml(file.xml, file.path, { exactTitle })
    return {
      id: file.id,
      sourceFilename: parsed.metadata.sourceFilename ?? file.path,
      parsed,
    }
  })
}
