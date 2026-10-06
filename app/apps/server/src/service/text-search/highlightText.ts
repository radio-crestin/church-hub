import { findHighlightRanges, wrapRanges } from './text/findHighlightRanges'

/**
 * A plain text as HTML with its matched words in <mark>, diacritic- and
 * punctuation-insensitive; everything else in it is escaped. The typed
 * query is tried first as a literal phrase, so the mark grows one letter at
 * a time while the user types.
 */
export function highlightText(
  text: string,
  searchTerms: string[],
  rawQuery?: string,
): string {
  const ranges =
    searchTerms.length || rawQuery
      ? findHighlightRanges(text, searchTerms, { rawQuery })
      : []
  return wrapRanges(text, ranges)
}
