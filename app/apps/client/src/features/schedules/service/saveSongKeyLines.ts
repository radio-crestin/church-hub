import { getSongById, upsertSong } from '../../songs/service/songs'

export interface SongKeyLineEdit {
  songId: number
  /** '' clears the gama. */
  keyLine: string
}

/**
 * Saves the gamas written in "Edit as text": only songs whose gama actually
 * changed are written, so an untouched program sends nothing.
 */
export async function saveSongKeyLines(edits: SongKeyLineEdit[]) {
  const lastEditBySong = new Map(edits.map((e) => [e.songId, e.keyLine]))
  await Promise.all(
    [...lastEditBySong].map(async ([songId, keyLine]) => {
      const song = await getSongById(songId)
      if (!song || (song.keyLine ?? '') === keyLine) return
      await upsertSong({
        id: songId,
        title: song.title,
        keyLine: keyLine || null,
      })
    }),
  )
}
