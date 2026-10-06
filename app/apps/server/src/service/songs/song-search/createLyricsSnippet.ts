import { escapeHtml } from '../../text-search/text/escapeHtml'
import {
  findHighlightRanges,
  wrapRanges,
} from '../../text-search/text/findHighlightRanges'

const SNIPPET_LENGTH = 150
const LEAD_IN = 30

/**
 * The stretch of the lyrics (plain text) with the most marked text, as HTML
 * with the matches wrapped in <mark> and everything else escaped. Shares the
 * range finder with the title highlight so the two always mark the same
 * thing.
 */
export function createLyricsSnippet(
  lyrics: string,
  searchTerms: string[],
  rawQuery: string,
): string {
  const text = lyrics.replace(/\s+/g, ' ')
  const ranges = findHighlightRanges(text, searchTerms, {
    rawQuery,
    fuzzy: true,
  })
  if (ranges.length === 0) {
    return text.length > SNIPPET_LENGTH
      ? `${escapeHtml(text.substring(0, SNIPPET_LENGTH))}...`
      : escapeHtml(text)
  }

  // Each window is anchored on a match and always wide enough to hold it.
  let bestStart = 0
  let bestEnd = Math.min(text.length, SNIPPET_LENGTH)
  let bestMarked = 0
  for (const range of ranges) {
    const start = Math.max(0, range.start - LEAD_IN)
    const end = Math.min(
      text.length,
      Math.max(start + SNIPPET_LENGTH, range.end),
    )
    const marked = ranges
      .filter((r) => r.start >= start && r.end <= end)
      .reduce((sum, r) => sum + (r.end - r.start), 0)
    if (marked > bestMarked) {
      bestMarked = marked
      bestStart = start
      bestEnd = end
    }
  }

  const local = ranges
    .filter((r) => r.start >= bestStart && r.end <= bestEnd)
    .map((r) => ({ start: r.start - bestStart, end: r.end - bestStart }))
  const prefix = bestStart > 0 ? '...' : ''
  const suffix = bestEnd < text.length ? '...' : ''
  return `${prefix}${wrapRanges(text.slice(bestStart, bestEnd), local)}${suffix}`
}
