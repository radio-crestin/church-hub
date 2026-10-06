import { findHighlightRanges, wrapRanges } from './text/findHighlightRanges'

/**
 * Marks the matched words in a text, diacritic- and punctuation-insensitive,
 * keeping the text as written. The typed query is tried first as a literal
 * phrase, so the mark grows one letter at a time while the user types.
 */
export function highlightText(
  text: string,
  searchTerms: string[],
  rawQuery?: string,
): string {
  if (!searchTerms.length && !rawQuery) return text
  const ranges = findHighlightRanges(text, searchTerms, { rawQuery })
  return ranges.length === 0 ? text : wrapRanges(text, ranges)
}
