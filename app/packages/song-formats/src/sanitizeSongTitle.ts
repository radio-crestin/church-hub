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

  // Replace non-letter/space/hyphen chars with space (preserves word boundaries)
  cleaned = cleaned.replace(/[^\p{L}\s-]/gu, ' ').trim()

  // Normalize multiple spaces/hyphens to single
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/-+/g, '-')

  // Remove the leading/trailing hyphen (by index: `-+$` is quadratic)
  let start = 0
  let end = cleaned.length
  while (start < end && cleaned[start] === '-') start++
  while (end > start && cleaned[end - 1] === '-') end--
  cleaned = cleaned.slice(start, end).trim()

  return cleaned || 'Untitled Song'
}
