/**
 * "Share my songs" (T-176): the church's songs, all or chosen categories,
 * published as a shared library (song-formats' library format) under
 * `libraries/<sourceId>/` through the sync service. The church needs no S3
 * keys: the service writes, with the cloud sync's server token.
 */
export interface LibraryShare {
  id: number
  /** `<churchId>-<random>`: the library's folder, which names its church. */
  sourceId: string
  name: string
  publisher: string
  /** The categories shared; null: the whole library. */
  categoryIds: number[] | null
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
  listed: boolean
}
