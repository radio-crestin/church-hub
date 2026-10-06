import { LOOPBACK_ALLOWED } from './isBlockedAddress'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * A shared source link must be https (plain http only to this machine, in
 * the e2e suite). Throws on anything else. Where the host resolves is
 * checked separately, by assertPublicUrl.
 */
export function requireLinkUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('The link is not a valid URL')
  }
  if (url.username || url.password) {
    throw new Error('The link must not contain a user name or password')
  }
  const testHttp =
    LOOPBACK_ALLOWED &&
    url.protocol === 'http:' &&
    LOOPBACK_HOSTS.has(url.hostname)
  if (url.protocol !== 'https:' && !testHttp) {
    throw new Error('The link must start with https://')
  }
  return url
}
