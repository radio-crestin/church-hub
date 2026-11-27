import { libraryRequest } from './libraryRequest'
import {
  type CategorySong,
  readCategorySongs,
} from '../song-sources/bundle/readCategorySongs'
import { songToOpenSong } from '../song-sources/bundle/songToOpenSong'

/** The service takes at most this many songs at once. */
export const MAX_SUBMITTED_SONGS = 500

/** Songs chosen one by one and whole categories, together. */
export interface SongSelection {
  songIds: number[]
  categoryIds: number[]
}

/** The selection's songs, each once. */
function readSelection({
  songIds,
  categoryIds,
}: SongSelection): CategorySong[] {
  const byId = new Map<number, CategorySong>()
  const groups = [
    ...categoryIds.map((categoryId) => readCategorySongs({ categoryId })),
    songIds.length ? readCategorySongs({ songIds }) : [],
  ]
  for (const song of groups.flat()) byId.set(song.id, song)
  return [...byId.values()]
}

/**
 * Sends songs of this church to the Church Hub Library's curators, each as
 * its OpenSong file, in one request: chosen songs and whole categories,
 * with an optional note for them.
 */
export async function submitSongsToLibrary(
  selection: SongSelection,
  note: string | null,
): Promise<{ batchId: string; submitted: number }> {
  const songs = readSelection(selection)
  if (songs.length === 0) throw new Error('song_not_found')
  if (songs.length > MAX_SUBMITTED_SONGS) throw new Error('too_many_songs')
  return libraryRequest('POST', '/submissions', {
    body: {
      songs: songs.map((song) => ({
        title: song.title,
        xml: songToOpenSong(song),
        sourceSongId: song.uuid,
      })),
      note,
    },
  })
}
