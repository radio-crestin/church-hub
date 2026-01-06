/**
 * Sanitizes a song title by removing special characters
 * Keeps: letters (including accented), spaces, and hyphens only
 *
 * Examples:
 *   "050 - Veniti crestini" → "Veniti crestini" (removes numbers)
 *   "/: Am căutat pe Domnul" → "Am căutat pe Domnul" (removes /: prefix)
 *   "Te-am ales să fii al Meu!" → "Te-am ales să fii al Meu" (removes !)
 *   '"O clipă" spune Isus' → 'O clipă spune Isus' (removes quotes)
 */
export function sanitizeSongTitle(title: string): string {
  if (!title.trim()) return 'Untitled Song'

  // Remove leading special characters like /:, numbers, etc.
  let cleaned = title.replace(/^[/:.*•►\d]+\s*/u, '')

  // Keep only: letters (including accented), spaces, and hyphens
  cleaned = cleaned.replace(/[^\p{L}\s-]/gu, '').trim()

  // Normalize multiple spaces/hyphens to single
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/-+/g, '-')

  // Remove leading/trailing hyphens
  cleaned = cleaned.replace(/^-+|-+$/g, '').trim()

  return cleaned || 'Untitled Song'
}
