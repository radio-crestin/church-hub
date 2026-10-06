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
