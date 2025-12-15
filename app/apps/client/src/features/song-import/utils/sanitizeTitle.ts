/**
 * Sanitizes a song title by removing special characters
 * Keeps only: letters (including accented), numbers, spaces, hyphens, underscores
 *
 * Examples:
 *   "/: Am căutat pe Domnul" → "Am căutat pe Domnul"
 *   "Te-am ales să fii al Meu!" → "Te-am ales să fii al Meu"
 *   "Song://test%file" → "Songtestfile"
 */
export function sanitizeSongTitle(title: string): string {
  if (!title.trim()) return 'Untitled Song'

  // Remove leading non-alphanumeric characters
  // \p{L} matches any letter (including accented), \p{N} matches any number
  let cleaned = title.replace(/^[^\p{L}\p{N}]+/u, '')

  // Keep only letters, numbers, spaces, hyphens, and underscores
  cleaned = cleaned.replace(/[^\p{L}\p{N}\s\-_]/gu, '').trim()

  return cleaned || 'Untitled Song'
}
