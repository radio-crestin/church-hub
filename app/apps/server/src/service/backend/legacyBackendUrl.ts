/**
 * The backend every released version up to the switch talks to (the
 * Cloudflare Worker). Those versions keep calling it, so it stays up and
 * unchanged (docs/backend-endpoint.md). CHURCH_HUB_LEGACY_BACKEND_URL points
 * the e2e suite at a stand-in for it.
 */
export function getLegacyBackendUrl(): string {
  return (
    process.env.CHURCH_HUB_LEGACY_BACKEND_URL ||
    'https://churchub-backend.radiocrestin.ro'
  ).replace(/\/+$/, '')
}
