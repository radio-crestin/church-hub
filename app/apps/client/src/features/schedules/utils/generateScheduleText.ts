import { expandSongSlidesWithChoruses } from '../../songs/utils/expandSongSlides'
import type { ScheduleItem } from '../types'

interface GenerateScheduleTextOptions {
  formatHelpLines?: string[]
  songSuffix?: string // e.g., 'S' for English, 'C' for Romanian (Cantec)
}

/**
 * Convert schedule items back to text format for editing
 */
export function generateScheduleText(
  items: ScheduleItem[],
  options?: GenerateScheduleTextOptions,
): string {
  const lines: string[] = []

  // Only show format help when the schedule is empty
  if (items.length === 0 && options?.formatHelpLines) {
    for (const line of options.formatHelpLines) {
      lines.push(`# ${line}`)
    }
    lines.push('')
  }

  const songSuffix = options?.songSuffix || 'S'

  for (const item of items) {
    if (item.itemType === 'song' && item.song) {
      lines.push(`${item.song.title} #${item.song.id} [${songSuffix}]`)
    } else if (item.itemType === 'bible_passage') {
      // Bible passage item - use the reference directly
      if (item.biblePassageReference) {
        // Remove translation suffix if present (e.g., "Ioan 3:16 - VDCC" -> "Ioan 3:16")
        const refWithoutTranslation = item.biblePassageReference
          .replace(/\s*-\s*[A-Z]+$/, '')
          .trim()
        lines.push(`${refWithoutTranslation} [V]`)
      }
    } else if (item.itemType === 'slide') {
      if (item.slideType === 'announcement') {
        // Strip HTML tags to get plain text
        const plainText = stripHtml(item.slideContent || '')
        if (plainText) {
          lines.push(`${plainText} [A]`)
        }
      } else if (item.slideType === 'versete_tineri') {
        // Check if we have structured entries
        if (item.verseteTineriEntries && item.verseteTineriEntries.length > 0) {
          // Format all entries on one line, comma-separated
          const entriesText = item.verseteTineriEntries
            .map((entry) => `${entry.personName} - ${entry.reference}`)
            .join(', ')
          lines.push(`${entriesText} [VT]`)
        } else {
          // Fallback: try to extract from HTML content (legacy format)
          const vtData = extractVerseteTineriData(item.slideContent || '')
          if (vtData) {
            lines.push(`${vtData.personName} - ${vtData.reference} [VT]`)
          } else {
            // Fallback: try to extract just Bible reference as V:
            const reference = extractBibleReference(item.slideContent || '')
            if (reference) {
              lines.push(`${reference} [V]`)
            } else {
              // Last fallback: show as announcement
              const plainText = stripHtml(item.slideContent || '')
              if (plainText) {
                lines.push(`${plainText} [A]`)
              }
            }
          }
        }
      } else if (item.slideType === 'scene' && item.obsSceneName) {
        // Scene item - output the OBS scene name
        lines.push(`${item.obsSceneName} [SC]`)
      }
    }
  }

  // Add reference section with full content (ignored by parser)
  if (items.length > 0) {
    const referenceLines = generateReferenceSection(items)
    if (referenceLines.length > 0) {
      lines.push('')
      lines.push('---')
      lines.push('')
      lines.push(...referenceLines)
    }
  }

  return lines.join('\n')
}

/**
 * Generate a read-only reference section showing the full content of each item
 */
function generateReferenceSection(items: ScheduleItem[]): string[] {
  const lines: string[] = []

  for (const item of items) {
    if (item.itemType === 'song' && item.song) {
      lines.push(`# ${item.song.title}`)
      const expandedSlides = expandSongSlidesWithChoruses(item.slides)
      for (const slide of expandedSlides) {
        const text = stripHtml(slide.content)
        if (text) {
          const label = slide.label ? ` (${slide.label})` : ''
          lines.push(`#   ${text.replace(/\n/g, ' / ')}${label}`)
        }
      }
      lines.push('#')
    } else if (item.itemType === 'bible_passage') {
      if (item.biblePassageReference) {
        lines.push(`# ${item.biblePassageReference}`)
      }
      for (const verse of item.biblePassageVerses) {
        lines.push(`#   ${verse.reference}: ${verse.text}`)
      }
      lines.push('#')
    } else if (
      item.itemType === 'slide' &&
      item.slideType === 'versete_tineri'
    ) {
      lines.push('# Versete Tineri')
      for (const entry of item.verseteTineriEntries) {
        lines.push(`#   ${entry.personName} - ${entry.reference}`)
        if (entry.text) {
          lines.push(`#     ${entry.text}`)
        }
      }
      lines.push('#')
    } else if (
      item.itemType === 'slide' &&
      item.slideType === 'announcement'
    ) {
      const plainText = stripHtml(item.slideContent || '')
      if (plainText) {
        lines.push(`# ${plainText}`)
        lines.push('#')
      }
    }
  }

  return lines
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
