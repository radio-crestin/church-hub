import JSZip from 'jszip'

import type { ScheduleWithItems } from '../../schedules/types'
import { sanitizeFilename } from '../../song-export/utils/createExportZip'
import { generatePptx } from '../../song-export/utils/generatePptx'

/**
 * Progress callback type for schedule ZIP generation
 */
type ProgressCallback = (current: number, total: number) => void

/**
 * Converts HTML content to plain text
 */
function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')

  text = text.replace(/<[^>]+>/g, '')

  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')

  return text.replace(/\n+$/, '').trim()
}

/**
 * Generates a text file content with the schedule information
 */
function generateScheduleText(schedule: ScheduleWithItems): string {
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push(schedule.title.toUpperCase())
  lines.push('='.repeat(60))
  lines.push('')

  if (schedule.description) {
    lines.push(schedule.description)
    lines.push('')
    lines.push('-'.repeat(60))
    lines.push('')
  }

  let itemNumber = 1
  for (const item of schedule.items) {
    if (item.itemType === 'song' && item.song) {
      lines.push(`${itemNumber}. [SONG] ${item.song.title}`)
      if (item.song.categoryName) {
        lines.push(`   Category: ${item.song.categoryName}`)
      }
      lines.push(`   Slides: ${item.slides.length}`)
      lines.push('')
    } else if (item.itemType === 'slide') {
      const slideTypeName =
        item.slideType === 'announcement'
          ? 'Announcement'
          : item.slideType === 'versete_tineri'
            ? 'Versete Tineri'
            : 'Slide'
      lines.push(`${itemNumber}. [${slideTypeName.toUpperCase()}]`)
      if (item.slideContent) {
        const content = htmlToPlainText(item.slideContent)
        const contentLines = content.split('\n').map((line) => `   ${line}`)
        lines.push(...contentLines)
      }
      if (
        item.slideType === 'versete_tineri' &&
        item.verseteTineriEntries?.length
      ) {
        for (const entry of item.verseteTineriEntries) {
          lines.push(
            `   - ${entry.personName}: ${entry.bookName} ${entry.reference}`,
          )
        }
      }
      lines.push('')
    } else if (item.itemType === 'bible_passage') {
      lines.push(
        `${itemNumber}. [BIBLE PASSAGE] ${item.biblePassageReference || 'Unknown reference'}`,
      )
      if (item.biblePassageTranslation) {
        lines.push(`   Translation: ${item.biblePassageTranslation}`)
      }
      if (item.biblePassageVerses?.length) {
        lines.push(`   Verses: ${item.biblePassageVerses.length}`)
      }
      lines.push('')
    }
    itemNumber++
  }

  lines.push('-'.repeat(60))
  lines.push(`Total items: ${schedule.items.length}`)
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push('')

  return lines.join('\n')
}

/**
 * Generates a song with slides for PPTX generation
 */
interface SongForPptx {
  title: string
  slides: Array<{ content: string; label: string | null; sortOrder: number }>
}

/**
 * Creates a ZIP archive containing:
 * - PPTX files for each song in the schedule
 * - A text file with the schedule overview
 */
export async function generateScheduleZip(
  schedule: ScheduleWithItems,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const zip = new JSZip()

  // Add schedule text file
  const scheduleText = generateScheduleText(schedule)
  const sanitizedScheduleTitle = sanitizeFilename(schedule.title)
  zip.file(`${sanitizedScheduleTitle} - Schedule.txt`, scheduleText)

  // Create a songs folder for PPTX files
  const songsFolder = zip.folder('songs')
  if (!songsFolder) {
    throw new Error('Failed to create songs folder')
  }

  // Get all songs from the schedule
  const songItems = schedule.items.filter(
    (item) => item.itemType === 'song' && item.song && item.slides.length > 0,
  )

  const totalItems = songItems.length
  let currentItem = 0

  // Generate PPTX for each song
  for (const item of songItems) {
    if (!item.song) continue

    const songForPptx: SongForPptx = {
      title: item.song.title,
      slides: item.slides.map((slide) => ({
        content: slide.content,
        label: slide.label,
        sortOrder: slide.sortOrder,
      })),
    }

    // Generate PPTX blob
    const pptxBlob = generatePptx(
      songForPptx as Parameters<typeof generatePptx>[0],
    )

    // Add order prefix to filename for proper sorting
    const orderPrefix = String(currentItem + 1).padStart(2, '0')
    const sanitizedTitle = sanitizeFilename(item.song.title)
    const filename = `${orderPrefix} - ${sanitizedTitle}.pptx`

    // Add to ZIP
    songsFolder.file(filename, pptxBlob)

    currentItem++
    onProgress?.(currentItem, totalItems)
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
