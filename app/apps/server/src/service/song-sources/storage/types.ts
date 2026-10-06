/** The user's S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, ...). */
export interface S3Storage {
  /** S3 API endpoint, e.g. https://<account>.r2.cloudflarestorage.com */
  endpoint: string
  region: string | null
  bucket: string
  /** Folder inside the bucket every published source goes under. */
  pathPrefix: string
  accessKeyId: string
  secretAccessKey: string
  /** Public, read-only base URL of the bucket (or of the prefix's bucket). */
  publicBaseUrl: string
}

/** The storage as the client sees it: the secret never leaves the server. */
export type S3StorageView = Omit<S3Storage, 'secretAccessKey'> & {
  hasSecret: boolean
}

/** What the settings form saves. An empty secret keeps the stored one. */
export type S3StorageInput = Omit<S3Storage, 'secretAccessKey'> & {
  secretAccessKey?: string
}
