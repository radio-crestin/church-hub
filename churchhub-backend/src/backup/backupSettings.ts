import type { Bindings } from '../types'
import { SyncError } from '../sync/SyncError'

const MIB = 1024 * 1024

/** The free tier, unless the environment overrides a limit. */
export const DEFAULT_LIMITS = {
  /** One upload: its user part, manifest and new resource blobs. */
  maxBackupBytes: 512 * MIB,
  /** Everything an account keeps, uploads in progress included. */
  quotaBytes: 2048 * MIB,
  /** A backup expires this many days after it was made. */
  retentionDays: 30,
  /** Uploads an account may start in a rolling 24 hours. */
  uploadsPerDay: 24,
}

export type BackupLimits = typeof DEFAULT_LIMITS

export interface BackupBucketSettings {
  endpoint: string
  /** Where presigned URLs point (the bucket's public address). */
  presignEndpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export interface BackupSettings {
  /** Signs tokens and the OAuth state; rotating it only signs everyone out. */
  secret: string
  /** Derives account ids and account keys; losing it loses every backup. */
  keySecret: string
  bucket: BackupBucketSettings
  limits: BackupLimits
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/**
 * The cloud backup service's settings, from Worker secrets or the process
 * environment. Missing any required one, /backup answers 503 not_configured,
 * so the rest of the backend deploys without them.
 */
export function readBackupSettings(env: Bindings): BackupSettings {
  const {
    BACKUP_SECRET,
    BACKUP_KEY_SECRET,
    BACKUP_S3_ENDPOINT,
    BACKUP_S3_BUCKET,
    BACKUP_S3_ACCESS_KEY_ID,
    BACKUP_S3_SECRET_ACCESS_KEY,
  } = env
  if (
    !BACKUP_SECRET ||
    !BACKUP_KEY_SECRET ||
    !BACKUP_S3_ENDPOINT ||
    !BACKUP_S3_BUCKET ||
    !BACKUP_S3_ACCESS_KEY_ID ||
    !BACKUP_S3_SECRET_ACCESS_KEY
  ) {
    throw new SyncError(503, 'not_configured', 'Cloud backup is not configured')
  }
  return {
    secret: BACKUP_SECRET,
    keySecret: BACKUP_KEY_SECRET,
    bucket: {
      endpoint: BACKUP_S3_ENDPOINT,
      presignEndpoint: env.BACKUP_S3_PRESIGN_ENDPOINT || BACKUP_S3_ENDPOINT,
      bucket: BACKUP_S3_BUCKET,
      region: env.BACKUP_S3_REGION || 'auto',
      accessKeyId: BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: BACKUP_S3_SECRET_ACCESS_KEY,
    },
    limits: {
      maxBackupBytes: positive(
        env.BACKUP_MAX_BYTES,
        DEFAULT_LIMITS.maxBackupBytes
      ),
      quotaBytes: positive(env.BACKUP_QUOTA_BYTES, DEFAULT_LIMITS.quotaBytes),
      retentionDays: positive(
        env.BACKUP_RETENTION_DAYS,
        DEFAULT_LIMITS.retentionDays
      ),
      uploadsPerDay: positive(
        env.BACKUP_UPLOADS_PER_DAY,
        DEFAULT_LIMITS.uploadsPerDay
      ),
    },
  }
}
