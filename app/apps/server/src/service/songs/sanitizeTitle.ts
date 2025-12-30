/**
 * Sanitizes a song title by removing special characters
 * Keeps: letters (including accented), numbers, spaces, hyphens, underscores, and quotes
 * Preserves leading numbers for numbered songs (e.g., "050 - Song Title")
 *
 * Examples:
 *   "050 - Veniti crestini" → "050 - Veniti crestini" (preserves number prefix)
 *   "/: Am căutat pe Domnul" → "Am căutat pe Domnul" (removes /: prefix)
 *   "Te-am ales să fii al Meu!" → "Te-am ales să fii al Meu" (removes !)
 *   '"O clipă" spune Isus' → '"O clipă" spune Isus' (preserves quotes)
 */
export function sanitizeSongTitle(title: string): string {
  if (!title.trim()) return 'Untitled Song'

  // Remove leading special characters like /:, but preserve numbers, letters, quotes, and hyphens
  // This allows "050 - Song" to stay as-is while "/: Chorus" becomes "Chorus"
  let cleaned = title.replace(/^[/:.*•►]+\s*/u, '')

  // Keep: letters, numbers, spaces, hyphens (including en/em dash), underscores, and quotes
  cleaned = cleaned.replace(/[^\p{L}\p{N}\s\-\u2013\u2014_"'""'']/gu, '').trim()

  return cleaned || 'Untitled Song'
}
