/** A backup kept in Church Hub Cloud, as the service lists it. */
export interface CloudBackupFile {
  id: string
  /** Its own bytes: encrypted user part + manifest (resource blobs are shared). */
  sizeBytes: number
  /** Resource blobs it references. */
  blobCount: number
  /** Unix ms; it expires `retentionDays` after. */
  createdAt: number
  appVersion: string
  keyVersion: number
  /** Blobs this upload had to send (the rest were already stored). */
  sentBlobs?: number
}

/** How much of its quota the account uses, and its limits. */
export interface CloudBackupUsage {
  usedBytes: number
  reservedBytes: number
  quotaBytes: number
  maxBackupBytes: number
  retentionDays: number
  uploadsPerDay: number
  suspended: boolean
}
