const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * A shared source link must be https; plain http only on this machine
 * (a local MinIO, a test server). Throws on anything else.
 */
export function requireLinkUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('The link is not a valid URL')
  }
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new Error('The link must start with https://')
  }
  return url
}
