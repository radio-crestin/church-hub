import { CloudBackupError } from './CloudBackupError'

/** Calls to the backup service give up after this long. */
const REQUEST_TIMEOUT_MS = 60_000
/** Service refusals the user can act on keep their status. */
const KEPT_STATUSES = new Set([401, 404, 409, 413, 429, 503])

/**
 * One JSON call to the backup service (churchhub-backend /backup). A
 * refusal becomes a CloudBackupError with the service's code; nothing of
 * the request (tokens, URLs) goes into the error.
 */
export async function cloudBackupFetch<T>(
  serviceUrl: string,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${serviceUrl.replace(/\/+$/, '')}${path}`, {
    method,
    headers: {
      ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw new CloudBackupError('service_unreachable')
  })
  const json = (await response.json().catch(() => ({}))) as T & {
    code?: string
  }
  if (!response.ok) {
    throw new CloudBackupError(
      typeof json.code === 'string' ? json.code : `http_${response.status}`,
      KEPT_STATUSES.has(response.status) ? response.status : 502,
    )
  }
  return json
}
