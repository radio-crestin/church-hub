import { getBackendBaseUrl } from '../../backend'

/**
 * The cloud sync service (churchhub-backend's /sync routes) a church connects
 * to; once connected it keeps the one it joined (its identity's serviceUrl).
 * CHURCH_HUB_SYNC_URL points tests at their own.
 */
export function getSyncServiceUrl(): string {
  return process.env.CHURCH_HUB_SYNC_URL || getBackendBaseUrl()
}
