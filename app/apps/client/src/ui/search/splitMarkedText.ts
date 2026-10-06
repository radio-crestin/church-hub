import { decodeHtmlEntities } from './decodeHtmlEntities'

export interface MarkedTextPart {
  text: string
  marked: boolean
}

const MARK_PATTERN = /<mark>([\s\S]*?)<\/mark>/g

/**
 * Splits a search result's text (plain text with <mark>…</mark> around the
 * matches, as the server sends it) into plain and marked parts. Only the mark
 * tags carry meaning; any other markup in the text stays literal text.
 */
export function splitMarkedText(text: string): MarkedTextPart[] {
  const parts: MarkedTextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(MARK_PATTERN)) {
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index), marked: false })
    }
    parts.push({ text: match[1], marked: true })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), marked: false })
  }
  return parts.map((part) => ({
    ...part,
    text: decodeHtmlEntities(part.text),
  }))
}
