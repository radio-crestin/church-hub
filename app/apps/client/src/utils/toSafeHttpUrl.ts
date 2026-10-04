/**
 * Returns `url` normalized when it is an absolute http(s) URL, else `null`.
 *
 * Guards every place a URL from outside the code (a typed server address, a
 * server message) is opened or loaded, so a `javascript:` or `data:` URL can
 * never run in the app.
 */
export function toSafeHttpUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return parsed.href
}
