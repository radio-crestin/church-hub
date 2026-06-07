/**
 * Wraps occurrences of the given terms in <mark> tags, matching
 * case- and diacritic-insensitively while preserving the original text.
 * Same output convention as the SQLite search paths.
 */
export function highlightTerms(text: string, terms: string[]): string {
  if (!text || terms.length === 0) return text

  // Build a folded copy (lowercase, no diacritics) with an index map back to
  // the original string so we can mark ranges on the original text.
  let folded = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const f = (text[i] as string)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    for (const ch of f) {
      folded += ch
      map.push(i)
    }
  }

  const ranges: Array<{ start: number; end: number }> = []
  for (const term of terms) {
    const needle = term.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    if (!needle) continue
    let from = 0
    for (;;) {
      const at = folded.indexOf(needle, from)
      if (at === -1) break
      const startIdx = map[at]
      const endIdx = map[at + needle.length - 1]
      if (startIdx !== undefined && endIdx !== undefined) {
        ranges.push({ start: startIdx, end: endIdx + 1 })
      }
      from = at + needle.length
    }
  }
  if (ranges.length === 0) return text

  // Merge overlapping ranges, then wrap from the end to keep indices valid.
  ranges.sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }

  let out = ''
  let pos = 0
  for (const { start, end } of merged) {
    out += text.slice(pos, start)
    out += `<mark>${text.slice(start, end)}</mark>`
    pos = end
  }
  out += text.slice(pos)
  return out
}
