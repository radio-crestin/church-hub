/** Mirrors the server's service/schedule-items/types.ts. */

/** Music: a whole folder of the Music library, or tracks picked by hand. */
export type MusicItemConfig = (
  | { source: 'folder'; folderId: number }
  | { source: 'tracks'; fileIds: number[] }
) & {
  /** A new random order each time it starts; else the library's order. */
  shuffle: boolean
}

/** Video: one from the gallery, or a random one each time. */
export type VideoItemConfig =
  | { source: 'file'; mediaId: string }
  | { source: 'random' }

/**
 * Verses from a book, or from a topic of the bundled lists, in
 * `translationId`: all of a topic's in order (`count` null), or `count` picked
 * at random, again on each loop.
 */
export type VersesItemConfig = (
  | { source: 'book'; bookCode: string }
  | { source: 'topic'; topicKey: string }
) & {
  translationId: number
  count: number | null
}

/** A Versete Biblice slide: null shows all its passages in order. */
export interface VerseteItemConfig {
  count: number | null
}

export type ItemConfig =
  | MusicItemConfig
  | VideoItemConfig
  | VersesItemConfig
  | VerseteItemConfig

/** What a music item plays, as the list shows it. */
export interface ScheduleMusicSummary {
  /** The folder's name; null for tracks picked by hand. */
  folderName: string | null
  trackCount: number
}

/** The video a video item shows this run. */
export interface ScheduleVideoPick {
  mediaId: string
  url: string
  /** How long it plays; null when it can't be read ahead (a WebM). */
  seconds: number | null
}

/** The new item types with settings, as the add menu offers them. */
export type MediaItemType = 'music' | 'video' | 'verses'
