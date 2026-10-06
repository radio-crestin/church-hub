import { BUILT_IN_SONG_SOURCES } from './builtInSongSources'

const ALLOWED_HOSTS = new Set(
  BUILT_IN_SONG_SOURCES.map((source) => new URL(source.url).hostname),
)

/**
 * The server proxies downloads only from the hosts of the built-in song
 * sources, fixed at build time, so it can't be used to fetch arbitrary URLs.
 * Sources added from links are read by the server itself (fetchLink).
 */
export function isProxyAllowedUrl(url: URL): boolean {
  return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname)
}
