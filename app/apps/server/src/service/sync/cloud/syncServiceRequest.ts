import type { CloudIdentity } from './cloudIdentityStore'

/** Requests to the sync service give up after this long. */
const REQUEST_TIMEOUT_MS = 60_000

/** The sync service's answer: its HTTP status and JSON body. */
export interface SyncServiceResponse<T> {
  status: number
  body: T & { error?: string; code?: string }
}

/**
 * Calls the sync service (churchhub-backend's /sync routes). With an
 * identity, `path` is under the church and the server token authenticates.
 */
export async function syncServiceRequest<T>(
  target: { serviceUrl: string; identity?: CloudIdentity },
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<SyncServiceResponse<T>> {
  const { serviceUrl, identity } = target
  const base = serviceUrl.replace(/\/+$/, '')
  const url = identity
    ? `${base}/sync/churches/${encodeURIComponent(identity.churchId)}${path}`
    : `${base}/sync${path}`
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(identity && { Authorization: `Bearer ${identity.serverToken}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: string
    code?: string
  }
  return { status: response.status, body: json }
}

/** The service's refusal as an error message: `<code>: <error>`. */
export function serviceError(response: SyncServiceResponse<unknown>): Error {
  const { code, error } = response.body
  return new Error(
    `Sync service ${response.status}${code ? ` ${code}` : ''}: ${error ?? 'request failed'}`,
  )
}
