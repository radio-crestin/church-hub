import { getApiUrl } from '~/config'

/**
 * Turns a stored background URL into one the current window can load.
 *
 * Uploaded media is stored as a server-relative path (`/api/media/...`), so it
 * keeps working when the server port or host changes. It must still be
 * prefixed with the API origin: the packaged Tauri window is served from
 * `tauri://localhost` / `http://tauri.localhost`, where a relative URL would
 * not reach the sidecar. Absolute URLs (older configs) are returned as-is.
 */
export function resolveMediaUrl(url: string): string {
  if (!url.startsWith('/') || url.startsWith('//')) return url
  return `${getApiUrl() ?? ''}${url}`
}
