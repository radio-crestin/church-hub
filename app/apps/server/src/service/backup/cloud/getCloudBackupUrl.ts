import { getBackendBaseUrl, getLegacyBackendUrl } from '../../backend'

/**
 * The backend cloud backup talks to: the one base URL every backend caller
 * uses (getBackendBaseUrl; docs/backend-endpoint.md).
 * CHURCH_HUB_BACKUP_URL narrows it for tests, as CHURCH_HUB_SYNC_URL does
 * for cloud sync.
 */
export function getCloudBackupUrl(): string {
  return (process.env.CHURCH_HUB_BACKUP_URL || getBackendBaseUrl()).replace(
    /\/+$/,
    '',
  )
}

/**
 * Cloud backup needs the new backend (presigned uploads, the admin panel,
 * shared rate limits): a build still pointed at the legacy Worker shows it
 * as not available yet instead of failing.
 */
export function isCloudBackupAvailable(): boolean {
  return getCloudBackupUrl() !== getLegacyBackendUrl()
}
