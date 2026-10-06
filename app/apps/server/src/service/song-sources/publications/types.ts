import type { SongBundleManifest } from '../bundle/types'

/** A category the user publishes to their S3 bucket as a shared source. */
export interface Publication {
  id: number
  categoryId: number
  categoryName: string
  /** Folder of this source inside the storage's path prefix. */
  folder: string
  /** The manifest as last uploaded; null until the first sync succeeds. */
  publishedManifest: SongBundleManifest | null
  lastSyncedAt: number | null
  lastError: string | null
}

/** A publication as the client sees it. */
export interface PublicationView {
  id: number
  categoryId: number
  categoryName: string
  /** The read-only link others add as a source; null without storage. */
  shareUrl: string | null
  songCount: number
  lastSyncedAt: number | null
  lastError: string | null
}
