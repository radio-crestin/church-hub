import { listSongSources } from './listSongSources'

/**
 * The server proxies downloads only from the hosts of known song sources,
 * so it can't be used to fetch arbitrary URLs.
 */
export function isProxyAllowedUrl(url: URL): boolean {
  if (url.protocol !== 'https:') return false
  return listSongSources().some(
    (source) => new URL(source.url).hostname === url.hostname,
  )
}
