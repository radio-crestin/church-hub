/**
 * The church's signaling relay (churchhub-backend's /signal routes, a
 * Cloudflare Worker): live translation's listeners and the phones' remote
 * access find this computer there. CHURCH_HUB_SIGNALING_URL points tests and
 * development at a local stand-in.
 */
export function getSignalingBaseUrl(): string {
  return (
    process.env.CHURCH_HUB_SIGNALING_URL ||
    'https://churchub-backend.radiocrestin.ro'
  )
}
