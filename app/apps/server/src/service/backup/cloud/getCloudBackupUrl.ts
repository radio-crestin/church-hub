import { getSyncServiceUrl } from '../../sync/cloud/getSyncServiceUrl'

/**
 * The Church Hub Cloud backup service (churchhub-backend's /backup routes):
 * CHURCH_HUB_BACKUP_URL, else the same backend cloud sync uses.
 */
export function getCloudBackupUrl(): string {
  return process.env.CHURCH_HUB_BACKUP_URL || getSyncServiceUrl()
}
