import type { ChordMapping, SlideStyleOverride } from '../songs/types'

export type SongHistoryKind = 'created' | 'edited' | 'restored'

/** A slide as kept in history: no ids, so two saves compare by content. */
export interface SongHistorySlide {
  content: string
  sortOrder: number
  label: string | null
  notes: string | null
  chords: ChordMapping[] | null
  styleOverrides: SlideStyleOverride | null
}

/** What a history entry remembers about a song: its title and its slides. */
export interface SongSnapshot {
  title: string
  slides: SongHistorySlide[]
}

/** Who made a change. `userId` is null for the system token / unknown caller. */
export interface SongEditor {
  userId: number | null
  name: string
}

/** Short summary of an entry, used by the list (no snapshots). */
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
  createdAt: number
  titleBefore: string | null
  titleAfter: string
  changes: SongHistoryChanges
}

export interface SongHistoryEntry extends SongHistoryEntrySummary {
  before: SongSnapshot | null
  after: SongSnapshot
}
