import { decodeHtmlEntities } from '../text-search/text/decodeHtmlEntities'

/**
 * Romanian hymnals close a repeated stanza with a marker glued to the end of
 * its last line: `/: … :/`, `//: … ://`, `|: … :|`, `(x2)`, `bis`.
 */
const REPETITION_MARKER =
  '(?:[/|]{1,2}:|:[/|]{1,2}|\\(?\\s*(?:x\\s*\\d+|\\d+\\s*x|bis)\\s*\\)?)'
const MARKER_ONLY_LINE = new RegExp(`^\\s*${REPETITION_MARKER}\\s*$`, 'i')
const TRAILING_MARKER = new RegExp(`[ \\t]+(${REPETITION_MARKER})[ \\t]*$`, 'i')
const NBSP = ' '
const HTML_TAG = /<[^>]*>/g

/**
 * A slide's stored HTML as the plain text the screens draw, which is also the
 * text its style ranges count characters in.
 *
 * Mirrors the client's `normalizeText` + `attachRepetitionMarkers`
 * (apps/client/src/features/presentation/components/rendering/utils/
 * normalizeText.ts, apps/client/src/utils/attachRepetitionMarkers.ts): the
 * offsets only line up while both read the HTML the same way.
 */
export function slidePlainText(html: string): string {
  const lines = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|div|h[1-6])[^>]*>/gi, '')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')

  const text = decodeHtmlEntities(removeHtmlTags(lines))
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return attachRepetitionMarkers(text)
}

function removeHtmlTags(html: string): string {
  let previous: string
  let text = html
  do {
    previous = text
    text = text.replace(HTML_TAG, '')
  } while (text !== previous)
  return text
}

/** Keeps a repetition marker on the line of the verse it closes. */
function attachRepetitionMarkers(text: string): string {
  const merged: string[] = []
  for (const line of text.split('\n')) {
    const previous = merged[merged.length - 1]
    if (MARKER_ONLY_LINE.test(line) && previous?.trim()) {
      merged[merged.length - 1] = `${previous.trimEnd()}${NBSP}${line.trim()}`
      continue
    }
    merged.push(line)
  }
  return merged
    .map((line) => line.replace(TRAILING_MARKER, `${NBSP}$1`))
    .join('\n')
}
