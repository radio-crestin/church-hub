/**
 * An `http(s)://host[:port]` origin, normalized the way browsers compare
 * origins (lowercase, default port dropped), or null for anything else.
 */
export function parseHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim())
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:'
    const isBare =
      url.pathname === '/' && !url.search && !url.hash && !url.username
    return isHttp && isBare ? url.origin : null
  } catch {
    return null
  }
}
