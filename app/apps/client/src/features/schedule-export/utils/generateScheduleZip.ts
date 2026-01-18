import JSZip from 'jszip'

import {
  generateChurchProgramJson,
  serializeChurchProgram,
} from './generateChurchProgramJson'
import type { ScheduleWithItems } from '../../schedules/types'
import { generateScheduleText } from '../../schedules/utils/generateScheduleText'
import { sanitizeFilename } from '../../song-export/utils/createExportZip'
import { generatePptx } from '../../song-export/utils/generatePptx'

/**
 * Progress callback type for schedule ZIP generation
 */
type ProgressCallback = (current: number, total: number) => void

/**
 * Generates a song with slides for PPTX generation
 */
interface SongForPptx {
  title: string
  slides: Array<{ content: string; label: string | null; sortOrder: number }>
}

/**
 * Creates a ZIP archive containing:
 * - A root folder named after the schedule
 * - PPTX files for each song in the schedule (inside songs subfolder)
 * - A text file with the schedule overview
 * - The ChurchHub .churchprogram JSON file
 */
export async function generateScheduleZip(
  schedule: ScheduleWithItems,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const zip = new JSZip()
  const sanitizedScheduleTitle = sanitizeFilename(schedule.title)

  // Create root folder with schedule name
  const rootFolder = zip.folder(sanitizedScheduleTitle)
  if (!rootFolder) {
    throw new Error('Failed to create schedule folder')
  }

  // Add schedule text file (using same format as Edit as Text modal)
  const scheduleText = generateScheduleText(schedule.items)
  rootFolder.file(`${sanitizedScheduleTitle} - Schedule.txt`, scheduleText)

  // Add ChurchHub .churchprogram JSON file
  const churchProgramData = generateChurchProgramJson(schedule)
  const churchProgramJson = serializeChurchProgram(churchProgramData)
  rootFolder.file(`${sanitizedScheduleTitle}.churchprogram`, churchProgramJson)

  // Create a songs folder for PPTX files
  const songsFolder = rootFolder.folder('songs')
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
