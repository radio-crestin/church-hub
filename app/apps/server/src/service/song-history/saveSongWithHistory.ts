import { captureSongSnapshot } from './captureSongSnapshot'
import { recordSongEdit } from './recordSongEdit'
import type { SongEditor } from './types'
import { upsertSong } from '../songs/songs'
import type { SongWithSlides, UpsertSongInput } from '../songs/types'

/**
 * Saves a song like `upsertSong` and records who changed what. The "before" is
 * read first, so an edit shows what the song looked like going in.
 */
export function saveSongWithHistory(
  input: UpsertSongInput,
  editor: SongEditor,
): SongWithSlides | null {
  const before = input.id ? captureSongSnapshot(input.id) : null
  const song = upsertSong(input)
  if (!song) return null

  const after = captureSongSnapshot(song.id)
  if (after) {
    recordSongEdit({
      songId: song.id,
      kind: before ? 'edited' : 'created',
      editor,
      before,
      after,
    })
  }
  return song
}
