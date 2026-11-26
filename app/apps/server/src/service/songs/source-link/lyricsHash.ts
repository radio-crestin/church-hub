import { normalizeLyrics } from '@church-hub/song-formats'

/**
 * The song's lyrics fingerprint, computed synchronously: the same value as
 * lyricsFingerprint in @church-hub/song-formats (SHA-256 hex of the
 * normalized lyrics), or null when the song has no lyrics.
 */
export function lyricsHash(blocks: string[]): string | null {
  const text = normalizeLyrics(blocks)
  if (!text) return null
  return new Bun.CryptoHasher('sha256').update(text).digest('hex')
}
