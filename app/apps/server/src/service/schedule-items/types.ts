/** Music: a whole folder of the Music library, or tracks picked by hand. */
export type MusicItemConfig = (
  | { source: 'folder'; folderId: number }
  | { source: 'tracks'; fileIds: number[] }
) & {
  /** A new random order each time it starts; else the library's order. */
  shuffle: boolean
}

/** Video: one from the video library, or a random one each time. */
export type VideoItemConfig =
  | { source: 'file'; mediaId: string }
  | { source: 'random' }

/**
 * Verses: from a book, or from a topic of the bundled lists, in
 * `translationId`. `count` null shows all of a topic's passages in order; a
 * number shows that many picked at random, again on each loop (a book always
 * takes a number). Verses picked by hand are a Versete Biblice slide, whose
 * `VerseteItemConfig` can show some of them at random the same way.
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

/** The item types that are only their settings. */
export type MediaItemType = 'music' | 'video' | 'verses'

/** `versete`: a Versete Biblice slide (how many of its passages it shows). */
export type ConfigurableItemType = MediaItemType | 'versete'

export type ItemConfig = ItemConfigs[ConfigurableItemType]

export interface ItemConfigs {
  music: MusicItemConfig
  video: VideoItemConfig
  verses: VersesItemConfig
  versete: VerseteItemConfig
}

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
}
