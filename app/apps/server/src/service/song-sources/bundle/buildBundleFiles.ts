import { sanitizeFilename } from '@church-hub/song-formats'

import { assembleBundle } from './assembleBundle'
import { type CategorySong, readCategorySongs } from './readCategorySongs'
import { songToOpenSong } from './songToOpenSong'
import type { SongBundleFiles } from './types'

/** The song's file name: its own file's name when it came from one, else its title. */
function baseName(song: CategorySong): string {
  const fromFile = song.sourceFilename
    ?.split(/[/\\]/)
    .pop()
    ?.replace(/\.[^.]+$/, '')
  return sanitizeFilename(fromFile || song.title) || `song-${song.id}`
}

/** A category's songs as a bundle: one OpenSong file per song plus the manifest. */
export function buildBundleFiles(
  categoryId: number,
  source: { name: string; categoryName: string },
): SongBundleFiles {
  return assembleBundle(
    source,
    readCategorySongs(categoryId).map((song) => ({
      id: song.uuid || `song-${song.id}`,
      title: song.title,
      baseName: baseName(song),
      xml: songToOpenSong(song),
    })),
  )
}
