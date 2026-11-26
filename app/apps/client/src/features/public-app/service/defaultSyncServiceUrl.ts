/**
 * Church Hub's cloud sync service; a join link names another one (`s=`)
 * when the church self-hosts it.
 */
export const DEFAULT_SYNC_SERVICE_URL =
  import.meta.env.VITE_SYNC_SERVICE_URL ||
  'https://churchub-backend.radiocrestin.ro'
