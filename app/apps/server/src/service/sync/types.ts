import type { SyncEntityType } from '../../db/schema/sync'

/** Serialized song slide (identified positionally within its song). */
export interface LibrarySlide {
  content: string
  chords: string | null
  label: string | null
  notes: string | null
  sortOrder: number
}

/** Serialized song aggregate (song row + slides), keyed by uuid. */
export interface LibrarySong {
  uuid: string
  title: string
  categoryUuid: string | null
  groupUuid: string | null
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  lastPresentedAt: number | null
  lastManualEdit: number | null
  createdAt: number
  updatedAt: number
  slides: LibrarySlide[]
}

export interface LibraryCategory {
  uuid: string
  name: string
  priority: number
  isHidden: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGroup {
  uuid: string
  canonicalTitle: string
  primarySongUuid: string | null
  createdAt: number
  updatedAt: number
}

export interface LibraryBibleVerse {
  verseId: number
  reference: string
  text: string
  sortOrder: number
}

export interface LibraryVerseteTineriEntry {
  personName: string
  translationId: number
  bookCode: string
  bookName: string
  reference: string
  text: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  sortOrder: number
}

export interface LibraryScheduleItem {
  itemType: 'song' | 'slide' | 'bible_passage'
  songUuid: string | null
  slideType: string | null
  slideContent: string | null
  biblePassageReference: string | null
  biblePassageTranslation: string | null
  obsSceneName: string | null
  sortOrder: number
  bibleVerses: LibraryBibleVerse[]
  verseteTineri: LibraryVerseteTineriEntry[]
}

/** Serialized schedule aggregate (schedule row + items + nested verses). */
export interface LibrarySchedule {
  uuid: string
  title: string
  description: string | null
  createdAt: number
  updatedAt: number
  items: LibraryScheduleItem[]
}

export interface LibraryTombstone {
  entityType: SyncEntityType
  uuid: string
  deletedAt: number
}

/**
 * The full serialized library — both the shape of the shared Drive file and
 * of the local snapshot the merge runs against. All timestamps are unix
 * seconds (matching the DB) so last-writer-wins comparisons are exact.
 */
export interface LibraryFile {
  schemaVersion: number
  updatedByDevice: string
  categories: LibraryCategory[]
  groups: LibraryGroup[]
  songs: LibrarySong[]
  schedules: LibrarySchedule[]
  tombstones: LibraryTombstone[]
}

export type LibraryAggregate =
  | LibraryCategory
  | LibraryGroup
  | LibrarySong
  | LibrarySchedule

/** One remote-driven change the merge wants applied to the local DB. */
export interface ApplyOp {
  entityType: SyncEntityType
  /**
   * `upsert` writes the remote aggregate (insert or update by uuid);
   * `delete` removes the local row for a remote tombstone.
   */
  op: 'upsert' | 'delete'
  uuid: string
  /** Present for upserts: the winning remote aggregate. */
  data?: LibraryAggregate
  /**
   * Feed classification: how this change should be reported to the user.
   * `conflict` = the overwritten local row had unsynced local edits.
   */
  changeKind: 'added' | 'updated' | 'removed' | 'conflict'
  /** Display title for the updates feed. */
  title: string
  /**
   * True when only per-device usage fields (presentation count, timestamps)
   * differ: the write is applied but no feed entry / badge is created.
   */
  silent?: boolean
}

export interface MergeResult {
  /** The merged library, to be uploaded as the new shared file. */
  merged: LibraryFile
  /** Remote-driven changes to apply to the local DB. */
  applyOps: ApplyOp[]
  /** True when the merged file differs from the remote file (upload needed). */
  uploadNeeded: boolean
}

export interface SyncCycleResult {
  success: boolean
  skipped?: 'disabled' | 'not_connected' | 'no_changes'
  applied?: number
  pushed?: boolean
  error?: string
}
