import PptxGenJS from 'pptxgenjs'

import type { SongWithSlides } from '~/features/songs/types'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'

/**
 * Default slide configuration matching the rendering engine
 */
const SLIDE_CONFIG = {
  width: 16, // 16:9 aspect ratio
  height: 9,
  background: '#000000',
  text: {
    color: 'FFFFFF',
    fontFace: 'Arial',
    fontSize: 44,
    bold: true,
    align: 'center' as const,
    valign: 'middle' as const,
  },
}

/**
 * Strips HTML tags and converts to plain text for PPTX
 */
function htmlToPlainText(html: string): string {
  // Replace <br> and </p> with newlines
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')

  // Remove any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')

  // Trim trailing newlines but keep internal ones
  return text.replace(/\n+$/, '').trim()
}

/**
 * Generates a PPTX presentation from a song
 * Matches the rendering engine configuration with:
 * - Black background
 * - White centered text
 * - Auto-scaling font
 */
export function generatePptx(song: SongWithSlides): Blob {
  const pptx = new PptxGenJS()

  // Set presentation properties
  pptx.author = 'Church Hub'
  pptx.title = song.title
  pptx.subject = 'Song Presentation'
  pptx.company = 'Church Hub'

  // Define a custom layout matching 16:9 aspect ratio
  pptx.defineLayout({
    name: 'CUSTOM_16x9',
    width: SLIDE_CONFIG.width,
    height: SLIDE_CONFIG.height,
  })
  pptx.layout = 'CUSTOM_16x9'

  // Expand slides with dynamic chorus insertion (C1 V1 C1 V2 C1 V3 C2...)
  const expandedSlides = expandSongSlidesWithChoruses(song.slides)

  // Create a slide for each expanded slide
  for (const songSlide of expandedSlides) {
    const slide = pptx.addSlide()

    // Set black background
    slide.background = { color: SLIDE_CONFIG.background.replace('#', '') }

    // Convert HTML content to plain text
    const text = htmlToPlainText(songSlide.content)

    if (text) {
      // Add centered text with styling matching rendering engine
      slide.addText(text, {
        x: 0.5,
        y: 0.5,
        w: SLIDE_CONFIG.width - 1,
        h: SLIDE_CONFIG.height - 1,
        color: SLIDE_CONFIG.text.color,
        fontFace: SLIDE_CONFIG.text.fontFace,
        fontSize: SLIDE_CONFIG.text.fontSize,
        bold: SLIDE_CONFIG.text.bold,
        align: SLIDE_CONFIG.text.align,
        valign: SLIDE_CONFIG.text.valign,
        shrinkText: true, // Enable auto-shrink for text fitting
      })
    }
  }

  // Generate the PPTX as a Blob
  return pptx.write({ outputType: 'blob' }) as unknown as Blob
}

/**
 * Generates a PPTX presentation and returns it as a base64 string
 */
export async function generatePptxBase64(
  song: SongWithSlides,
): Promise<string> {
  const pptx = new PptxGenJS()

  // Set presentation properties
  pptx.author = 'Church Hub'
  pptx.title = song.title
  pptx.subject = 'Song Presentation'
  pptx.company = 'Church Hub'

  // Define a custom layout matching 16:9 aspect ratio
  pptx.defineLayout({
    name: 'CUSTOM_16x9',
    width: SLIDE_CONFIG.width,
    height: SLIDE_CONFIG.height,
  })
  pptx.layout = 'CUSTOM_16x9'

  // Expand slides with dynamic chorus insertion (C1 V1 C1 V2 C1 V3 C2...)
  const expandedSlides = expandSongSlidesWithChoruses(song.slides)

  // Create a slide for each expanded slide
  for (const songSlide of expandedSlides) {
    const slide = pptx.addSlide()

    // Set black background
    slide.background = { color: SLIDE_CONFIG.background.replace('#', '') }

    // Convert HTML content to plain text
    const text = htmlToPlainText(songSlide.content)

    if (text) {
      // Add centered text with styling matching rendering engine
      slide.addText(text, {
        x: 0.5,
        y: 0.5,
        w: SLIDE_CONFIG.width - 1,
        h: SLIDE_CONFIG.height - 1,
        color: SLIDE_CONFIG.text.color,
        fontFace: SLIDE_CONFIG.text.fontFace,
        fontSize: SLIDE_CONFIG.text.fontSize,
        bold: SLIDE_CONFIG.text.bold,
        align: SLIDE_CONFIG.text.align,
        valign: SLIDE_CONFIG.text.valign,
        shrinkText: true, // Enable auto-shrink for text fitting
      })
    }
  }

  // Generate the PPTX as base64
  const data = await pptx.write({ outputType: 'base64' })
  return data as string
}
