/** Songs picked one by one and whole categories, together. */
export interface SongSelection {
  categoryIds: number[]
  /** With their titles, to show what was picked. */
  songs: Array<{ id: number; title: string }>
}

export const EMPTY_SONG_SELECTION: SongSelection = {
  categoryIds: [],
  songs: [],
}
