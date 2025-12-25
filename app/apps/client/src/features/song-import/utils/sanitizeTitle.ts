/**
 * Sanitizes a song title by removing special characters
 * Keeps only: letters (including accented), numbers, spaces, hyphens (including en/em dashes)
 * Leading numbers are also removed (e.g., "1. Song" → "Song")
 *
 * Examples:
 *   "1. E zi de har şi sărbătoare" → "E zi de har şi sărbătoare"
 *   "/: Am căutat pe Domnul" → "Am căutat pe Domnul"
 *   "Te-am ales să fii al Meu!" → "Te-am ales să fii al Meu"
 *   "A Domnului casă s–o cinstești" → "A Domnului casă s–o cinstești" (preserves en-dash)
 */
export function sanitizeSongTitle(title: string): string {
  if (!title.trim()) return 'Untitled Song'

  // Remove leading non-letter characters (including numbers, dots, etc.)
  // \p{L} matches any letter (including accented characters)
  let cleaned = title.replace(/^[^\p{L}]+/u, '')

  // Keep only letters, numbers, spaces, hyphens (regular, en-dash, em-dash)
  // \- is regular hyphen (U+002D), \u2013 is en-dash (–), \u2014 is em-dash (—)
  cleaned = cleaned.replace(/[^\p{L}\p{N}\s\-\u2013\u2014]/gu, '').trim()

  return cleaned || 'Untitled Song'
}
