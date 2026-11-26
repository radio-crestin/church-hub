import type { LibrarySongInput } from '@church-hub/song-formats'

import type { LibraryShare } from './types'
import { getRawDatabase } from '../../../db'
import { readCategorySongs } from '../bundle/readCategorySongs'
import { songToOpenSong } from '../bundle/songToOpenSong'

/** Every category id, plus null for the songs filed under none. */
function allCategories(): Array<number | null> {
  const rows = getRawDatabase()
    .query<{ id: number }, []>('SELECT id FROM song_categories')
    .all()
  return [...rows.map((row) => row.id), null]
}

/** The songs a share publishes, each as its OpenSong file and lyrics. */
export function readShareSongs(share: LibraryShare): LibrarySongInput[] {
  const categories = share.categoryIds ?? allCategories()
  return categories.flatMap((categoryId) =>
    readCategorySongs(categoryId).map((song) => ({
      id: song.uuid || `song-${song.id}`,
      title: song.title,
      xml: songToOpenSong(song),
      lyrics: song.slides.map((slide) => slide.content),
    })),
  )
}
