import { getApiUrl } from '~/config'
import { apiFetch } from '~/utils/apiFetch'
import { getAuthHeaders } from '~/utils/getAuthHeaders'

/**
 * fetch for a path on this app's server, signed in as the current user:
 * the browser's cookie, the desktop app's `X-User-Auth` or the phone app's
 * cookie header, so the server checks that user's permissions.
 */
export function serverFetch(path: string, init: RequestInit = {}) {
  return apiFetch(`${getApiUrl() ?? ''}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...getAuthHeaders(),
    },
  })
}
