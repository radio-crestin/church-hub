/**
 * "Share my songs" (T-176, T-177): a group of the church's songs (the whole
 * library, or chosen categories and hand-picked songs) published as a shared
 * library (song-formats' library format) under `libraries/<sourceId>/`
 * through the sync service. A church may have several shares, each with its
 * own link. The church needs no S3 keys: the service writes, with the cloud
 * sync's server token.
 */
export interface LibraryShare {
  id: number
  /** `<churchId>-<random>`: the library's folder, which names its church. */
  sourceId: string
  name: string
  publisher: string
  /** The categories shared; null: the whole library (songIds then unused). */
  categoryIds: number[] | null
  /** Songs picked one by one, besides the categories' songs. */
  songIds: number[]
  /** The picked songs still in the library, with their titles, to show them. */
  songs: Array<{ id: number; title: string }>
  /** In the public catalog; unlisted (link only) by default. */
  listed: boolean
  /** Where others add it from; null until the first publish. */
  manifestUrl: string | null
  publishedChecksum: string | null
  /** Shard paths already in the bucket, so a publish uploads only new ones. */
  publishedShards: string[]
  songCount: number
  lastSyncedAt: number | null
  lastError: string | null
}

/** What the user chooses. */
export interface LibraryShareInput {
  name: string
  publisher?: string
  categoryIds: number[] | null
  songIds: number[]
  listed: boolean
}
