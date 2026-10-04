import type { BibleBookmarkStyleRange } from './types'
import type { bibleBookmarks } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { escapeMarkdown, parseStyledMarkdown } from '../bookmark-markdown'

const logger = createLogger('bible-bookmarks')

/**
 * Reads a stored bookmark's Markdown back into the ranges the live slide
 * draws. A row whose Markdown no longer spells its verse text reads as
 * unstyled rather than putting marks on the wrong words.
 */
export function readBookmarkStyles(
  record: Pick<typeof bibleBookmarks.$inferSelect, 'id' | 'text' | 'markdown'>,
): { markdown: string; styleRanges: BibleBookmarkStyleRange[] } {
  const markdown = record.markdown ?? escapeMarkdown(record.text)
  const parsed = parseStyledMarkdown(markdown)

  if (parsed.text !== record.text) {
    logger.warning(`Bookmark ${record.id}: Markdown does not match its verse`)
    return { markdown: escapeMarkdown(record.text), styleRanges: [] }
  }

  return {
    markdown,
    styleRanges: parsed.ranges.map((range, index) => ({
      id: `bookmark-${record.id}-${index}`,
      ...range,
    })),
  }
}
