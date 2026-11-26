/** One finished backup an account keeps. */
export interface BackupEntry {
  id: string
  /** Bytes as stored (encrypted and gzipped). */
  sizeBytes: number
  /** Unix ms. */
  createdAt: number
  appVersion: string
  /** The account key version the backup's data key is wrapped with. */
  keyVersion: number
}

/** An upload started and not finished yet: its size is reserved. */
export interface PendingUpload {
  id: string
  uploadId: string
  sizeBytes: number
  partSize: number
  partCount: number
  appVersion: string
  keyVersion: number
  /** Unix ms. */
  startedAt: number
}

/**
 * What the service keeps per account, as JSON in the private bucket
 * (accounts/<accountId>/account.json). No email, name or Google id: the
 * account id is a keyed hash of the Google `sub`.
 */
export interface AccountRecord {
  version: 1
  /** Tokens issued at or before this (unix ms) are refused: sign-out, deletion. */
  tokensValidAfter: number
  backups: BackupEntry[]
  uploads: PendingUpload[]
  /** When uploads started in the last 24 hours (unix ms), for the daily limit. */
  uploadLog: number[]
}

export const emptyAccount = (): AccountRecord => ({
  version: 1,
  tokensValidAfter: 0,
  backups: [],
  uploads: [],
  uploadLog: [],
})
