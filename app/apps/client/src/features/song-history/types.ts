export type SongHistoryKind = 'created' | 'edited' | 'restored'

/** Which side of an entry to put back: the song before or after that change. */
export type RestoreSide = 'before' | 'after'

export interface SongHistorySlide {
  content: string
  sortOrder: number
  label: string | null
  notes: string | null
}

export interface SongSnapshot {
  title: string
  slides: SongHistorySlide[]
}

export interface SongHistoryChanges {
  titleChanged: boolean
  slidesAdded: number
  slidesRemoved: number
  slidesChanged: number
}

export interface SongHistoryEntrySummary {
  id: number
  songId: number
  kind: SongHistoryKind
  editedByUserId: number | null
  editedByName: string
  restoredFromId: number | null
  /** Unix timestamp, seconds. */
  createdAt: number
  titleBefore: string | null
  titleAfter: string
  changes: SongHistoryChanges
}

export interface SongHistoryEntry extends SongHistoryEntrySummary {
  before: SongSnapshot | null
  after: SongSnapshot
}
