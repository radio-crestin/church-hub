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
    fontSize: 52,
    bold: true,
    align: 'center' as const,
    valign: 'middle' as const,
  },
  keyLine: {
    color: 'CCCCCC',
    fontFace: 'Arial',
    fontSize: 18,
    bold: false,
    align: 'right' as const,
    valign: 'bottom' as const,
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
 * Adds "Amin!" to text if it doesn't already contain it
 */
function addAmin(text: string): string {
  if (/amin/i.test(text)) return text
  return `${text}\n\nAmin!`
}

/**
 * Creates a configured PptxGenJS instance with all slides populated
 */
function buildPptx(song: SongWithSlides): PptxGenJS {
  const pptx = new PptxGenJS()

  pptx.author = 'Church Hub'
  pptx.title = song.title
  pptx.subject = 'Song Presentation'
  pptx.company = 'Church Hub'

  pptx.defineLayout({
    name: 'CUSTOM_16x9',
    width: SLIDE_CONFIG.width,
    height: SLIDE_CONFIG.height,
  })
  pptx.layout = 'CUSTOM_16x9'

  const expandedSlides = expandSongSlidesWithChoruses(song.slides)
  const hasKeyLine = Boolean(song.keyLine)

  for (let i = 0; i < expandedSlides.length; i++) {
    const songSlide = expandedSlides[i]
    const isLastSlide = i === expandedSlides.length - 1
    const slide = pptx.addSlide()

    slide.background = { color: SLIDE_CONFIG.background.replace('#', '') }

    let text = htmlToPlainText(songSlide.content)

    if (isLastSlide && text) {
      text = addAmin(text)
    }

    if (text) {
      slide.addText(text, {
        x: 0.5,
        y: 0.5,
        w: SLIDE_CONFIG.width - 1,
        h: SLIDE_CONFIG.height - (hasKeyLine ? 1.2 : 1),
        color: SLIDE_CONFIG.text.color,
        fontFace: SLIDE_CONFIG.text.fontFace,
        fontSize: SLIDE_CONFIG.text.fontSize,
        bold: SLIDE_CONFIG.text.bold,
        align: SLIDE_CONFIG.text.align,
        valign: SLIDE_CONFIG.text.valign,
        shrinkText: true,
      })
    }

    if (song.keyLine) {
      slide.addText(song.keyLine, {
        x: SLIDE_CONFIG.width - 4,
        y: SLIDE_CONFIG.height - 0.8,
        w: 3.5,
        h: 0.5,
        color: SLIDE_CONFIG.keyLine.color,
        fontFace: SLIDE_CONFIG.keyLine.fontFace,
        fontSize: SLIDE_CONFIG.keyLine.fontSize,
        bold: SLIDE_CONFIG.keyLine.bold,
        align: SLIDE_CONFIG.keyLine.align,
        valign: SLIDE_CONFIG.keyLine.valign,
      })
    }
  }

  return pptx
}

/**
 * Generates a PPTX presentation from a song as a Blob
 */
export function generatePptx(song: SongWithSlides): Blob {
  const pptx = buildPptx(song)
  return pptx.write({ outputType: 'blob' }) as unknown as Blob
}

/**
 * Generates a PPTX presentation and returns it as a base64 string
 */
export async function generatePptxBase64(
  song: SongWithSlides,
): Promise<string> {
  const pptx = buildPptx(song)
  const data = await pptx.write({ outputType: 'base64' })
  return data as string
}
