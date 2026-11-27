import type { LibrarySongInput } from '@church-hub/song-formats'

import type { LibraryShare } from './types'
import { getRawDatabase } from '../../../db'
import {
  type CategorySong,
  readCategorySongs,
} from '../bundle/readCategorySongs'
import { songToOpenSong } from '../bundle/songToOpenSong'

/** Every category id, plus null for the songs filed under none. */
function allCategories(): Array<number | null> {
  const rows = getRawDatabase()
    .query<{ id: number }, []>('SELECT id FROM song_categories')
    .all()
  return [...rows.map((row) => row.id), null]
}

/**
 * The songs a share publishes, each once, as its OpenSong file and lyrics:
 * its categories' songs (every category for the whole library), then the
 * songs picked one by one.
 */
export function readShareSongs(share: LibraryShare): LibrarySongInput[] {
  const categories = share.categoryIds ?? allCategories()
  const songs: CategorySong[] = categories.flatMap((categoryId) =>
    readCategorySongs({ categoryId }),
  )
  if (share.categoryIds && share.songIds.length > 0) {
    songs.push(...readCategorySongs({ songIds: share.songIds }))
  }
  const seen = new Set<number>()
  return songs
    .filter((song) => !seen.has(song.id) && seen.add(song.id))
    .map((song) => ({
      id: song.uuid || `song-${song.id}`,
      title: song.title,
      xml: songToOpenSong(song),
      lyrics: song.slides.map((slide) => slide.content),
    }))
}
