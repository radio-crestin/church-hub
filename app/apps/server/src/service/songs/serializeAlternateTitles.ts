/**
 * The JSON a song's alternate titles are stored as, or null when there are
 * none worth storing.
 *
 * Blank entries and duplicates are dropped so the column holds a clean set —
 * it is indexed with the title, and a repeated name would only weight the
 * search index towards itself.
 */
export function serializeAlternateTitles(
  titles: string[] | null | undefined,
): string | null {
  if (!titles) return null

  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const title of titles) {
    const trimmed = typeof title === 'string' ? title.trim() : ''
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    cleaned.push(trimmed)
  }
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null
}
