/** One word of a line, with the chord played on it. */
export interface SharedSongWord {
  word: string
  chord?: string
}

/** A slide as a song's public page shows it. */
export interface SharedSongSlide {
  label: string | null
  lines: SharedSongWord[][]
}

/** What the sync service keeps for a song's link (its SharedSongInput). */
export interface SharedSongInput {
  title: string
  author: string | null
  copyright: string | null
  keyLine: string | null
  slides: SharedSongSlide[]
}

/** A song's link, as the app hands it out. */
export interface SongLink {
  url: string
}
