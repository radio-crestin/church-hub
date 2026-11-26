import { parseHttpOrigin } from './parseHttpOrigin'

/**
 * Whether an origin is the server itself as this request reached it
 * (`Origin` matches `Host`): a browser on the church network that loaded
 * the app from this server, by IP address or by name.
 */
export function isRequestOwnOrigin(origin: string, req: Request): boolean {
  const host = req.headers.get('host')
  if (!host) return false
  return (
    origin === parseHttpOrigin(`http://${host}`) ||
    origin === parseHttpOrigin(`https://${host}`)
  )
}
