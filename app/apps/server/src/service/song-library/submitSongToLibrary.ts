import { libraryRequest } from './libraryRequest'
import { readCategorySongs } from '../song-sources/bundle/readCategorySongs'
import { songToOpenSong } from '../song-sources/bundle/songToOpenSong'

/**
 * Sends one of this church's songs to the Church Hub Library's curators,
 * as its OpenSong file, with an optional note for them.
 */
export async function submitSongToLibrary(
  songId: number,
  note: string | null,
): Promise<{ id: string; submittedAt: number }> {
  const [song] = readCategorySongs({ songId })
  if (!song) throw new Error('song_not_found')
  return libraryRequest('POST', '/submissions', {
    body: {
      title: song.title,
      xml: songToOpenSong(song),
      sourceSongId: song.uuid,
      note,
    },
  })
}
