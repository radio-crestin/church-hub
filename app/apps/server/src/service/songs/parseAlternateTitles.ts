/**
 * The other names a song goes by, from the JSON column that stores them.
 *
 * A library imported with "use the first verse as the title" files a song
 * under its opening line, so the name it is actually known by only survives
 * here. Anything malformed reads as "no alternate titles" rather than throwing:
 * a bad row must not take the search index down with it.
 */
export function parseAlternateTitles(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  } catch {
    return []
  }
}

/**
 * The titles a song should be findable by, as one string for the FTS `title`
 * column. Duplicates are dropped so a song whose alternate title equals its
 * title is not indexed twice.
 */
export function joinSearchTitles(
  title: string,
  alternateTitlesJson: string | null | undefined,
): string {
  const seen = new Set<string>()
  const titles: string[] = []
  for (const candidate of [
    title,
    ...parseAlternateTitles(alternateTitlesJson),
  ]) {
    const key = candidate.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    titles.push(candidate.trim())
  }
  return titles.join(' ')
}
