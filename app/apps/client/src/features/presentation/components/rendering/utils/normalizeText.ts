import { decodeHtmlEntities } from '../../../../../utils/decodeHtmlEntities'
import { removeHtmlTags } from '../../../../../utils/removeHtmlTags'

/**
 * Decodes HTML entities and normalizes slide markup into plain text with
 * newline-separated lines. Shared by the read-only renderer (AnimatedText),
 * the in-place slide editor (EditableMainText), TextElement, the chords
 * overlay and addChordsToContent, so all of them read stored slide HTML
 * identically.
 */
export function normalizeText(html: string, isHtml: boolean): string {
  if (!isHtml) return html

  const lines = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|div|h[1-6])[^>]*>/gi, '')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')

  return decodeHtmlEntities(removeHtmlTags(lines))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
