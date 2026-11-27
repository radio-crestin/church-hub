/** One word of a line, with the chord played on it. */
export interface SharedSongWord {
  word: string
  chord?: string
}

/** A slide of a shared song: its label (V1, C…) and its lines. */
export interface SharedSongSlide {
  label: string | null
  lines: SharedSongWord[][]
}

/**
 * A song shared by a link (T-177): what its public page shows, and the
 * church and song it is, so a device of that church opens it in the app.
 */
export interface SharedSong {
  format: 'church-hub-shared-song'
  version: 1
  churchId: string
  songUuid: string
  title: string
  author: string | null
  copyright: string | null
  keyLine: string | null
  slides: SharedSongSlide[]
  sharedAt: number
}

/** What a church sends: the song as it reads now. */
export type SharedSongInput = Pick<
  SharedSong,
  'title' | 'author' | 'copyright' | 'keyLine' | 'slides'
>
