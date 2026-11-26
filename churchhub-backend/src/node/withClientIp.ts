const CLIENT_IP_HEADER = 'CF-Connecting-IP'

/**
 * The request with `CF-Connecting-IP` set to the resolved client address,
 * replacing any value the client sent, so the routes (written for Cloudflare,
 * which sets that header itself) read a trustworthy address.
 */
export function withClientIp(request: Request, clientIp: string): Request {
  const headers = new Headers(request.headers)
  headers.set(CLIENT_IP_HEADER, clientIp)
  return new Request(request, { headers })
}
