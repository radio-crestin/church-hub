import type { Tunnel } from './createTunnel'

/** Statuses whose Response has no body. */
const NULL_BODY = new Set([101, 103, 204, 205, 304])

const toBase64 = (buffer: ArrayBuffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/**
 * Sends a request to the computer's server over the tunnel, by its path,
 * and answers as fetch would. The phone signs in with its own token
 * (X-User-Auth, when it has one): the browser drops a Cookie header set by
 * hand.
 */
export async function tunnelFetch(
  tunnel: Tunnel,
  request: Request,
  token: string | null,
): Promise<Response> {
  const url = new URL(request.url)
  const headers: Array<[string, string]> = []
  request.headers.forEach((value, name) => headers.push([name, value]))
  if (token && !request.headers.has('X-User-Auth')) {
    headers.push(['X-User-Auth', token])
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const response = await tunnel.request({
    method: request.method,
    path: url.pathname + url.search,
    headers,
    body: hasBody ? toBase64(await request.arrayBuffer()) : undefined,
  })
  const body = NULL_BODY.has(response.status)
    ? null
    : new Blob([response.body as BlobPart])
  return new Response(body, {
    status: response.status,
    headers: response.headers,
  })
}
