import { decodeHtmlEntities } from '~/utils/decodeHtmlEntities'
import { removeHtmlTags } from '~/utils/removeHtmlTags'

/**
 * Strips HTML tags and converts slide content to plain text
 */
export function htmlToPlainText(html: string): string {
  // Replace <br> and </p> with newlines
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')

  // Remove any remaining HTML tags, then decode HTML entities
  text = decodeHtmlEntities(removeHtmlTags(text))

  // Trim trailing newlines but keep internal ones
  return text.replace(/\n+$/, '').trim()
}
