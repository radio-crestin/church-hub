/**
 * The sync service of a join link without `s=`: released versions leave it
 * out for the legacy backend, so this stays that one even after the app moves
 * to a new backend (current versions always name theirs, buildJoinUrl.ts).
 * docs/backend-endpoint.md
 */
export const DEFAULT_SYNC_SERVICE_URL =
  import.meta.env.VITE_SYNC_SERVICE_URL ||
  'https://churchub-backend.radiocrestin.ro'
