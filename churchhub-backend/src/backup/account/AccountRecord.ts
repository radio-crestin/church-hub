/** One finished backup an account keeps. */
export interface BackupEntry {
  id: string
  /** Bytes as stored (encrypted and gzipped), read from the bucket. */
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
 * One signed-in PC: its refresh tokens form a chain. Each refresh moves
 * `generation` on; a refresh token of an older generation means a copy was
 * used (theft), which ends every session of the account.
 */
export interface SessionFamily {
  generation: number
  createdAt: number
  lastUsedAt: number
}

/**
 * What the service keeps per account, as JSON in the private bucket
 * (accounts/<accountId>/account.json), changed only by compare-and-swap.
 * The folder is named by a keyed hash of the Google `sub`; the email is
 * kept for the internal admin panel only.
 */
export interface AccountRecord {
  version: 1
  /** Tokens issued at or before this (unix ms) are refused. */
  tokensValidAfter: number
  sessions: Record<string, SessionFamily>
  /** Bytes of the finished backups: the authoritative usage counter. */
  usedBytes: number
  /** An admin's quota for this account; null = the global default. */
  quotaBytes: number | null
  /** An admin paused new uploads (downloads still work). */
  suspended: boolean
  email: string | null
  createdAt: number | null
  lastSignInAt: number | null
  lastBackupAt: number | null
  lastReconciledAt: number | null
  backups: BackupEntry[]
  uploads: PendingUpload[]
  /** When uploads started in the last 24 hours (unix ms), for the daily limit. */
  uploadLog: number[]
}

export const emptyAccount = (): AccountRecord => ({
  version: 1,
  tokensValidAfter: 0,
  sessions: {},
  usedBytes: 0,
  quotaBytes: null,
  suspended: false,
  email: null,
  createdAt: null,
  lastSignInAt: null,
  lastBackupAt: null,
  lastReconciledAt: null,
  backups: [],
  uploads: [],
  uploadLog: [],
})
