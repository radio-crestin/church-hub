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
  lines.push('# V: Ioan 3:16 (Bible passage)')
  lines.push('# VT: Person Name - Ioan 3:16, Person 2 - Ioan 3:17 (Youth verses)')
  lines.push('')

  for (const item of items) {
    if (item.itemType === 'song' && item.song) {
      lines.push(`S: ${item.song.title}`)
    } else if (item.itemType === 'bible_passage') {
      // Bible passage item - use the reference directly
      if (item.biblePassageReference) {
        // Remove translation suffix if present (e.g., "Ioan 3:16 - VDCC" -> "Ioan 3:16")
        const refWithoutTranslation = item.biblePassageReference
          .replace(/\s*-\s*[A-Z]+$/, '')
          .trim()
        lines.push(`V: ${refWithoutTranslation}`)
      }
    } else if (item.itemType === 'slide') {
      if (item.slideType === 'announcement') {
        // Strip HTML tags to get plain text
        const plainText = stripHtml(item.slideContent || '')
        if (plainText) {
          lines.push(`A: ${plainText}`)
        }
      } else if (item.slideType === 'versete_tineri') {
        // Check if we have structured entries
        if (item.verseteTineriEntries && item.verseteTineriEntries.length > 0) {
          // Format all entries on one line, comma-separated
          const entriesText = item.verseteTineriEntries
            .map((entry) => `${entry.personName} - ${entry.reference}`)
            .join(', ')
          lines.push(`VT: ${entriesText}`)
        } else {
          // Fallback: try to extract from HTML content (legacy format)
          const vtData = extractVerseteTineriData(item.slideContent || '')
          if (vtData) {
            lines.push(`VT: ${vtData.personName} - ${vtData.reference}`)
          } else {
            // Fallback: try to extract just Bible reference as V:
            const reference = extractBibleReference(item.slideContent || '')
            if (reference) {
              lines.push(`V: ${reference}`)
            } else {
              // Last fallback: show as announcement
              const plainText = stripHtml(item.slideContent || '')
              if (plainText) {
                lines.push(`A: ${plainText}`)
              }
            }
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

/**
 * Try to extract person name and Bible reference from versete_tineri content
 * Format: "PersonName - Reference" (e.g., "Ion Popescu - Ioan 3:16")
 */
function extractVerseteTineriData(
  html: string,
): { personName: string; reference: string } | null {
  const plainText = stripHtml(html)

  // Try to find pattern: Name - Reference
  // Match text before " - " as name, and Bible reference after
  const vtPattern =
    /^(.+?)\s*[-–—]\s*(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+\s+\d+\s*[:.,]\s*\d+(?:\s*[-–—]\s*(?:\d+\s*[:.,]\s*)?\d+)?)/i

  const match = plainText.match(vtPattern)
  if (match) {
    return {
      personName: match[1].trim(),
      reference: match[2].trim(),
    }
  }

  return null
}
