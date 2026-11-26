import { isAllowedOrigin } from '../../middleware/security'

/**
 * Where a sign-in may hand its ticket: the church PC's own server on
 * loopback (the app's local callback), or an allowed web origin. Anything
 * else could collect another person's ticket.
 */
export function isAllowedReturnUrl(
  returnUrl: string,
  allowedOrigins: string | undefined
): boolean {
  let url: URL
  try {
    url = new URL(returnUrl)
  } catch {
    return false
  }
  const loopback =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  return loopback || isAllowedOrigin(url.origin, allowedOrigins)
}
