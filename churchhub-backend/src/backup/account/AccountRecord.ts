/**
 * One finished backup: an encrypted manifest and encrypted user part of its
 * own, plus the shared resource blobs it references by hash.
 */
export interface BackupEntry {
  id: string
  /** Unix ms; the backup expires BACKUP_RETENTION_DAYS after it. */
  createdAt: number
  appVersion: string
  /** The account key version the user part and manifest are wrapped with. */
  keyVersion: number
  /** Bytes of the encrypted user part, as stored. */
  userBytes: number
  /** Bytes of the encrypted manifest, as stored. */
  manifestBytes: number
  /** SHA-256 (hex) of every resource blob the backup needs. */
  blobs: string[]
}

/**
 * A resource blob of the account: plaintext, content-addressed, never
 * rewritten. `refs` counts the backups and uploads in flight that need it;
 * at zero it is deleted. Counted once in the usage, however many refer to it.
 */
export interface BlobEntry {
  /** Bytes as stored (gzipped). */
  sizeBytes: number
  refs: number
  /** False until an upload's completion found it in the bucket. */
  stored: boolean
}

/** An upload started and not finished yet: its bytes are reserved. */
export interface PendingUpload {
  id: string
  /** The multipart upload of the user part. */
  uploadId: string
  userBytes: number
  manifestBytes: number
  partSize: number
  partCount: number
  /** Every blob the backup references (each holds one ref for it). */
  blobs: string[]
  /** The blobs not stored when it started: this upload sends them. */
  newBlobs: { hash: string; sizeBytes: number }[]
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
  version: 2
  /** Tokens issued at or before this (unix ms) are refused. */
  tokensValidAfter: number
  sessions: Record<string, SessionFamily>
  /**
   * Bytes stored: every backup's user part and manifest, plus each stored
   * blob once. The authoritative usage counter.
   */
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
  /**
   * 128 random bits in every blob's key: a blob's URL can't be guessed from
   * its content's hash (a public Bible's hash is easy to compute).
   */
  blobPrefix: string
  blobs: Record<string, BlobEntry>
  backups: BackupEntry[]
  uploads: PendingUpload[]
  /** When uploads started in the last 24 hours (unix ms), for the daily limit. */
  uploadLog: number[]
}

export const emptyAccount = (): AccountRecord => ({
  version: 2,
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
  blobPrefix: '',
  blobs: {},
  backups: [],
  uploads: [],
  uploadLog: [],
})
