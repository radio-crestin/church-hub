import type { BibleBookmarkStyleRange } from './types'

/**
 * Reads the stored JSON back into style ranges.
 *
 * Bad or missing JSON yields no styling rather than an error - a bookmark is
 * still perfectly readable without its highlights.
 */
export function parseStyleRanges(
  json: string | null,
): BibleBookmarkStyleRange[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
