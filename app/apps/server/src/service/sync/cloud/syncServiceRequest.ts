import type { CloudIdentity } from './cloudIdentityStore'
import { getInstallation } from './getInstallation'
import { oneWriteAtATime } from './oneWriteAtATime'
import { setServerConflict } from './serverConflict'
import { reportTokenRefused } from './tokenRefused'

/** Requests to the sync service give up after this long. */
const REQUEST_TIMEOUT_MS = 60_000

/** The sync service's answer: its HTTP status and JSON body. */
export interface SyncServiceResponse<T> {
  status: number
  body: T & { error?: string; code?: string }
}

interface ServerInUseBody {
  code?: string
  otherPc?: { name?: string | null; lastSeenAt?: number | null }
}

/**
 * Calls the sync service (churchhub-backend's /sync routes). With an
 * identity, `path` is under the church (or, `atRoot`, under /sync, as the
 * shared libraries are) and the server token authenticates;
 * `ownerTicket` signs in as the church's owner instead. Every call names
 * this installation (a PC's; a browser has none), so the service can tell a
 * second PC holding the same token (a restored backup) from this one: its
 * 409 server_in_use is kept (getServerConflict) and thrown as
 * `server_in_use`. Writes go one at a time (oneWriteAtATime).
 */
export async function syncServiceRequest<T>(
  target: {
    serviceUrl: string
    identity?: CloudIdentity
    ownerTicket?: string
    atRoot?: boolean
  },
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<SyncServiceResponse<T>> {
  const { serviceUrl, identity, ownerTicket, atRoot } = target
  const base = serviceUrl.replace(/\/+$/, '')
  const url =
    identity && !atRoot
      ? `${base}/sync/churches/${encodeURIComponent(identity.churchId)}${path}`
      : `${base}/sync${path}`
  const token = identity?.serverToken ?? ownerTicket
  const installation = getInstallation()
  // A gzipped file (a library shard) goes as it is; anything else as JSON.
  const binary = body instanceof Uint8Array
  const send = () =>
    fetch(url, {
      method,
      headers: {
        'Content-Type': binary ? 'application/gzip' : 'application/json',
        ...(installation && {
          'X-Church-Hub-Installation': installation.id,
          'X-Church-Hub-Installation-Name': encodeURIComponent(
            installation.name,
          ),
        }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: binary
        ? (body as BodyInit)
        : body === undefined
          ? undefined
          : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  const response = await (method === 'GET' ? send() : oneWriteAtATime(send))
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: string
    code?: string
  }
  if (identity && response.status === 409 && json.code === 'server_in_use') {
    const { otherPc } = json as ServerInUseBody
    setServerConflict({
      otherPcName: otherPc?.name ?? null,
      otherPcLastSeenAt: otherPc?.lastSeenAt ?? null,
    })
    throw new Error('server_in_use')
  }
  if (identity && response.ok) setServerConflict(null)
  if (identity && response.status === 401) reportTokenRefused()
  return { status: response.status, body: json }
}

/** The service's refusal as an error message: `<code>: <error>`. */
export function serviceError(response: SyncServiceResponse<unknown>): Error {
  const { code, error } = response.body
  return new Error(
    `Sync service ${response.status}${code ? ` ${code}` : ''}: ${error ?? 'request failed'}`,
  )
}
