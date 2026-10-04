import { slidePlainText } from './slidePlainText'
import {
  formatStyledMarkdown,
  type MarkdownStyleRange,
} from '../bookmark-markdown'
import { parseStyleOverrides } from '../songs/song-slides'

/**
 * A slide's lyrics as Markdown, with the bold, italic and underline set on
 * the slide itself — on the whole slide or on selected words.
 */
export function slideMarkdown(
  html: string,
  storedOverrides: string | null,
): string {
  const text = slidePlainText(html)
  const override = parseStyleOverrides(storedOverrides)
  if (!override) return formatStyledMarkdown(text, [])

  const ranges: MarkdownStyleRange[] = (override.ranges ?? []).map((range) => ({
    start: range.start,
    end: range.end,
    bold: range.bold,
    italic: range.italic,
    underline: range.underline,
  }))

  if (override.bold || override.italic || override.underline) {
    ranges.push({
      start: 0,
      end: text.length,
      bold: override.bold,
      italic: override.italic,
      underline: override.underline,
    })
  }

  return formatStyledMarkdown(text, ranges)
}
