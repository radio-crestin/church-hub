import { decodeHtmlEntities } from '~/utils/decodeHtmlEntities'
import { removeHtmlTags } from '~/utils/removeHtmlTags'

/**
 * A slide's words in the order chords count them: each line's words, then a
 * `'\n'` token for the line break (it takes a word position too).
 */
export function getSlideWords(html: string): string[] {
  const lines = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
  const text = decodeHtmlEntities(removeHtmlTags(lines)).trim()
  if (!text) return []

  const tokens: string[] = []
  for (const line of text.split('\n')) {
    tokens.push(...line.split(/\s+/).filter(Boolean))
    tokens.push('\n')
  }
  tokens.pop()
  return tokens
}
