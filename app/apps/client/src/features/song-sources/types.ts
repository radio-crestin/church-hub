/** Mirrors the server's `S3StorageView`: the secret never comes back. */
export interface S3Storage {
  endpoint: string
  region: string | null
  bucket: string
  pathPrefix: string
  accessKeyId: string
  publicBaseUrl: string
  hasSecret: boolean
}

/** What the storage form saves; an empty secret keeps the stored one. */
export interface S3StorageInput {
  endpoint: string
  region: string | null
  bucket: string
  pathPrefix: string
  accessKeyId: string
  secretAccessKey?: string
  publicBaseUrl: string
}

/** Mirrors the server's `PublicationView`. */
export interface Publication {
  id: number
  categoryId: number
  categoryName: string
  shareUrl: string | null
  songCount: number
  lastSyncedAt: number | null
  lastError: string | null
}

/** "Share my songs": mirrors the server's `LibraryShare`. */
export interface LibraryShare {
  id: number
  sourceId: string
  name: string
  publisher: string
  /** null: the whole library. */
  categoryIds: number[] | null
  listed: boolean
  /** The link others add as a song source; null until the first publish. */
  manifestUrl: string | null
  songCount: number
  /** Unix ms. */
  lastSyncedAt: number | null
  lastError: string | null
}

export interface LibraryShareInput {
  name: string
  categoryIds: number[] | null
  listed: boolean
}

/** The share, and whether cloud sync (which sharing goes through) is on. */
export interface LibraryShareState {
  share: LibraryShare | null
  cloudSync: boolean
}
