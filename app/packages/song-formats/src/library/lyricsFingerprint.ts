import { normalizeLyrics } from './normalizeLyrics'
import { sha256Hex } from './sha256Hex'

/**
 * SHA-256 hex of a song's normalized lyrics: the same words give the same
 * fingerprint whatever the formatting, diacritics, title or file name.
 * Empty lyrics have no fingerprint.
 */
export async function lyricsFingerprint(
  blocks: string[],
): Promise<string | null> {
  const text = normalizeLyrics(blocks)
  return text ? sha256Hex(text) : null
}
