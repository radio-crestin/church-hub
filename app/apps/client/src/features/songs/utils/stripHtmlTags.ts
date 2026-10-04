import { attachRepetitionMarkers } from '../../../utils/attachRepetitionMarkers'
import { decodeHtmlEntities } from '../../../utils/decodeHtmlEntities'
import { removeHtmlTags } from '../../../utils/removeHtmlTags'

/**
 * Slide HTML as plain, line-broken text.
 *
 * Paragraph boundaries and `<br>` become newlines so the lyrics keep their
 * shape; everything else is dropped. Used wherever a slide has to be *read*
 * rather than presented — the slide list, the program items panel, and the
 * song preview in the add-to-program modal.
 */
export function stripHtmlTags(html: string): string {
  const lines = html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
  const stripped = removeHtmlTags(lines).trim()
  return attachRepetitionMarkers(decodeHtmlEntities(stripped))
}
