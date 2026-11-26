/** A backup kept in Church Hub Cloud, as the service lists it. */
export interface CloudBackupFile {
  id: string
  /** Bytes as stored (encrypted and gzipped). */
  sizeBytes: number
  /** Unix ms. */
  createdAt: number
  appVersion: string
  keyVersion: number
}

/** How much of the free tier the account uses, and its limits. */
export interface CloudBackupUsage {
  usedBytes: number
  maxBackupBytes: number
  quotaBytes: number
  maxBackups: number
  uploadsPerDay: number
}
