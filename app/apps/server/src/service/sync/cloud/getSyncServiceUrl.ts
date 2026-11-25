/**
 * The cloud sync service (churchhub-backend's /sync routes). A church that
 * self-hosts it, and the tests, point CHURCH_HUB_SYNC_URL at their own.
 */
export function getSyncServiceUrl(): string {
  return (
    process.env.CHURCH_HUB_SYNC_URL ||
    'https://churchub-backend.radiocrestin.ro'
  )
}
