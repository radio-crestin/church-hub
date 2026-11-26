import { getLegacyBackendUrl } from './legacyBackendUrl'

/**
 * Church Hub's backend (churchhub-backend): Google sign-in for YouTube, Drive
 * and the cloud owner, cloud sync, the signaling relay, feature requests.
 * Release builds bake CHURCH_HUB_BUILD_BACKEND_URL (build-desktop.yml, from
 * the BACKEND_PUBLIC_URL repo variable); unset, it is the legacy backend.
 * CHURCH_HUB_BACKEND_URL overrides both on one machine (development, tests,
 * a self-hosted backend). How to switch: docs/backend-endpoint.md.
 */
export function getBackendBaseUrl(): string {
  return (
    process.env.CHURCH_HUB_BACKEND_URL ||
    process.env.CHURCH_HUB_BUILD_BACKEND_URL ||
    getLegacyBackendUrl()
  ).replace(/\/+$/, '')
}
