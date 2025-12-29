/**
 * Sanitizes a song title by removing special characters
 * Keeps: letters (including accented), numbers, spaces, hyphens, underscores, and quotes
 * Leading numbers are also removed (e.g., "1. Song" → "Song")
 *
 * Examples:
 *   "1. E zi de har şi sărbătoare" → "E zi de har şi sărbătoare"
 *   "/: Am căutat pe Domnul" → "Am căutat pe Domnul"
 *   "Te-am ales să fii al Meu!" → "Te-am ales să fii al Meu"
 *   '"O clipă" spune Isus' → '"O clipă" spune Isus'
 */
export function sanitizeSongTitle(title: string): string {
  if (!title.trim()) return 'Untitled Song'

  // Remove leading non-letter characters (including numbers, dots, etc.)
  // But allow leading quotes as they may be part of the title
  // \p{L} matches any letter (including accented characters)
  let cleaned = title.replace(/^[^\p{L}"'""'']+/u, '')

  // Keep: letters, numbers, spaces, hyphens, underscores, and quotes (ASCII and Unicode)
  cleaned = cleaned.replace(/[^\p{L}\p{N}\s\-_"'""'']/gu, '').trim()

  return cleaned || 'Untitled Song'
}
