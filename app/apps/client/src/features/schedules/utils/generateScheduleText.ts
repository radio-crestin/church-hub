import type { ScheduleItem } from '../types'

/**
 * Convert schedule items back to text format for editing
 */
export function generateScheduleText(items: ScheduleItem[]): string {
  const lines: string[] = []

  // Add format help as comments at the top
  lines.push('# Format examples:')
  lines.push('# S: Song Title')
  lines.push('# A: Announcement text')
  lines.push('# V: Ioan 3:16')
  lines.push('')

  for (const item of items) {
    if (item.itemType === 'song' && item.song) {
      lines.push(`S: ${item.song.title}`)
    } else if (item.itemType === 'slide') {
      if (item.slideType === 'announcement') {
        // Strip HTML tags to get plain text
        const plainText = stripHtml(item.slideContent || '')
        if (plainText) {
          lines.push(`A: ${plainText}`)
        }
      } else if (item.slideType === 'versete_tineri') {
        // Try to extract reference from content, or use generic marker
        const reference = extractBibleReference(item.slideContent || '')
        if (reference) {
          lines.push(`V: ${reference}`)
        } else {
          // Fallback: show as announcement since we can't reconstruct the reference
          const plainText = stripHtml(item.slideContent || '')
          if (plainText) {
            lines.push(`A: ${plainText}`)
          }
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Try to extract Bible reference from slide content
 * Looks for patterns like "Ioan 3:16" or "Psalm 23:1-6"
 */
function extractBibleReference(html: string): string | null {
  const plainText = stripHtml(html)

  // Pattern for Bible references: Book Chapter:Verse(-Verse)?
  // Supports Romanian book names with diacritics
  const referencePattern =
    /(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+)\s+(\d+)\s*[:.,]\s*(\d+)(?:\s*[-–—]\s*(?:(\d+)\s*[:.,]\s*)?(\d+))?/i

  const match = plainText.match(referencePattern)
  if (match) {
    return match[0].trim()
  }

  return null
}
