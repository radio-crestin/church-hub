import {
  deleteServerSecret,
  readServerSecret,
  upsertServerSecret,
} from '../../server-secrets'

const KEY = 'cloud_backup_credential'

/**
 * What keeps this PC signed in to Church Hub Cloud backup: the service it
 * signed in to, the refresh token and the account's email. Kept in
 * server_secrets, which no HTTP route reads.
 */
export interface CloudBackupCredential {
  serviceUrl: string
  refreshToken: string
  /** Unix seconds. */
  refreshExpiresAt: number
  email: string
}

export function readCloudBackupCredential(): CloudBackupCredential | null {
  const value = readServerSecret(KEY)
  return value ? (JSON.parse(value) as CloudBackupCredential) : null
}

export function saveCloudBackupCredential(
  credential: CloudBackupCredential | null,
): void {
  if (credential) upsertServerSecret(KEY, JSON.stringify(credential))
  else deleteServerSecret(KEY)
}
