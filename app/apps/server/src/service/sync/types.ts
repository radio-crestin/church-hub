import type { SyncUpdateEntry } from './updatesFeed'
import type { SyncEntityType } from '../../db/schema/sync'
import type { ScheduleItemType } from '../schedules/types'

/** Serialized song slide (identified positionally within its song). */
export interface LibrarySlide {
  content: string
  chords: string | null
  label: string | null
  notes: string | null
  /** JSON `SlideStyleOverride`, or null when the screen defaults apply. */
  styleOverrides: string | null
  sortOrder: number
}

/**
 * Name of the device that last modified an aggregate. Stamped at serialize
 * time on locally-dirty rows, inherited from the remote file otherwise, and
 * shown in the sync changes list ("modified on <device>").
 */
export interface DeviceAttributed {
  modifiedByDevice?: string | null
}

/** Serialized song aggregate (song row + slides), keyed by uuid. */
export interface LibrarySong extends DeviceAttributed {
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
  /** Absent from libraries written before T-173. */
  alternateTitles?: string | null
  /**
   * Its background override (ScreenBackgroundConfig as JSON); its media
   * reaches phones through the church's bucket (cloud-media). Absent before
   * T-215: left as it is.
   */
  background?: string | null
  /** The song's tags (song_tag uuids). Absent before T-173. */
  tagUuids?: string[]
  presentationCount: number
  lastPresentedAt: number | null
  lastManualEdit: number | null
  createdAt: number
  updatedAt: number
  slides: LibrarySlide[]
}

export interface LibraryCategory extends DeviceAttributed {
  uuid: string
  name: string
  priority: number
  isHidden: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGroup extends DeviceAttributed {
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
  itemType: ScheduleItemType
  songUuid: string | null
  slideType: string | null
  slideContent: string | null
  biblePassageReference: string | null
  biblePassageTranslation: string | null
  obsSceneName: string | null
  /**
   * A music, video or verses item's settings, as JSON (service/schedule-items).
   * Absent from libraries written before them. Music folders and tracks,
   * videos and translations are named by this device's ids.
   */
  itemConfig?: string | null
  /** A `schedule` item's presentation. Absent from older libraries. */
  childScheduleUuid?: string | null
  /** Absent from libraries written before T-173 (as are isSung, sungAt). */
  advanceSeconds?: number | null
  isSung?: number
  sungAt?: number | null
  sortOrder: number
  bibleVerses: LibraryBibleVerse[]
  verseteTineri: LibraryVerseteTineriEntry[]
}

/** Serialized schedule aggregate (schedule row + items + nested verses). */
export interface LibrarySchedule extends DeviceAttributed {
  uuid: string
  title: string
  description: string | null
  /** How it plays; absent from libraries written before T-173. */
  playback?: LibrarySchedulePlayback
  createdAt: number
  updatedAt: number
  items: LibraryScheduleItem[]
}

/** A schedule's automation settings (its row's columns). */
export interface LibrarySchedulePlayback {
  autoplaySeconds: number | null
  autoplayByText: number
  loop: number
  musicVolume: number | null
  startOnAppStart: number
  startTrigger: string | null
  stopTrigger: string | null
}

/** A row the sync engine carries as it is: its own fields, keyed by uuid. */
interface LibraryRecord extends DeviceAttributed {
  uuid: string
  createdAt: number
  updatedAt: number
}

export interface LibraryTag extends LibraryRecord {
  name: string
  sortOrder: number
}

export interface LibrarySongBookmark extends LibraryRecord {
  songUuid: string
  /** For the updates feed only. */
  songTitle?: string
  sortOrder: number
  isSung: number
  sungAt: number | null
}

/** A free-text row between bookmarks (song or Bible). */
export interface LibraryBookmarkNote extends LibraryRecord {
  content: string
  sortOrder: number
}

/** A Bible bookmark, named by translation and verse, not this device's ids. */
export interface LibraryBibleBookmark extends LibraryRecord {
  translationAbbreviation: string
  bookCode: string
  bookName: string
  chapter: number
  verse: number
  reference: string
  text: string
  markdown: string | null
  sortOrder: number
}

/** A playlist item, named by its file's path (files stay on their device). */
export interface LibraryPlaylistItem {
  path: string
  title: string | null
  artist: string | null
  duration: number | null
  sortOrder: number
}

export interface LibraryPlaylist extends LibraryRecord {
  name: string
  description: string | null
  items: LibraryPlaylistItem[]
}

/** A church-wide app setting (syncedTables.ts); its uuid is its key. */
export interface LibrarySetting extends LibraryRecord {
  value: string
}

export interface LibraryRole extends LibraryRecord {
  name: string
  isSystem: number
  permissions: string[]
}

/** An account: never its login token or password, which stay on the PC. */
export interface LibraryUser extends LibraryRecord {
  name: string
  isActive: number
  isSuperAdmin: number
  roleUuid: string | null
  permissions: string[]
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
  /* T-173: absent from files written before (read as empty). */
  tags: LibraryTag[]
  songBookmarks: LibrarySongBookmark[]
  songBookmarkNotes: LibraryBookmarkNote[]
  bibleBookmarks: LibraryBibleBookmark[]
  bibleBookmarkNotes: LibraryBookmarkNote[]
  playlists: LibraryPlaylist[]
  settings: LibrarySetting[]
  roles: LibraryRole[]
  users: LibraryUser[]
  tombstones: LibraryTombstone[]
}

/** The LibraryFile's collections of aggregates. */
export type LibraryCollectionKey = Exclude<
  keyof LibraryFile,
  'schemaVersion' | 'updatedByDevice' | 'tombstones'
>

export type LibraryAggregate = LibraryFile[LibraryCollectionKey][number]

/** One remote-driven change the merge wants applied to the local DB. */
export interface ApplyOp {
  entityType: SyncEntityType
  /**
   * `upsert` writes the remote aggregate (insert or update by uuid);
   * `delete` removes the local row for a remote tombstone; `keep` leaves the
   * local row as it is (a refused row the church never had).
   */
  op: 'upsert' | 'delete' | 'keep'
  uuid: string
  /** Present for upserts: the winning remote aggregate. */
  data?: LibraryAggregate
  /**
   * Feed classification: how this change should be reported to the user.
   * `conflict` = the overwritten local row had unsynced local edits.
   */
  changeKind: SyncUpdateEntry['changeKind']
  /** Display title for the updates feed. */
  title: string
  /** Device the winning remote version was modified on, when known. */
  sourceDevice?: string | null
  /** For `rejected`: the permission its author lacked. */
  detail?: string
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
}

export interface SyncCycleResult {
  success: boolean
  skipped?: 'disabled' | 'not_connected' | 'no_changes'
  applied?: number
  pushed?: boolean
  error?: string
}
