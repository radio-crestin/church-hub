import { getBackendBaseUrl, getLegacyBackendUrl } from '../../backend'

/**
 * Cloud backup needs the new backend (presigned uploads, the admin panel,
 * shared rate limits): while the one backend base URL every caller uses
 * (getBackendBaseUrl; docs/backend-endpoint.md) is still the legacy
 * Worker, the app shows it as not available yet instead of failing.
 */
export function isCloudBackupAvailable(): boolean {
  return getBackendBaseUrl() !== getLegacyBackendUrl()
}
