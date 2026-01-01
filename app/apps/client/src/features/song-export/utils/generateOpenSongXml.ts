import type { SongWithSlides } from '~/features/songs/types'
import { generateExpandedPresentationOrder } from '~/features/songs/utils/expandSongSlides'

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generates an XML element if the value is not null/empty
 */
function xmlElement(tagName: string, value: string | null | undefined): string {
  if (!value) return ''
  return `  <${tagName}>${escapeXml(value)}</${tagName}>\n`
}

/**
 * Strips HTML tags and converts to plain text
 * The content in slides is stored as HTML (e.g., <p>Line 1</p><p>Line 2</p>)
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
  return text.replace(/\n+$/, '')
}

/**
 * Generates the lyrics section from slides
 * OpenSong format uses [LABEL] followed by lines with leading space
 */
function generateLyrics(slides: SongWithSlides['slides']): string {
  if (!slides || slides.length === 0) return ''

  const lines: string[] = []

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const isLastSlide = i === slides.length - 1

    // Add verse label if present
    if (slide.label) {
      lines.push(`[${slide.label}]`)
    }

    // Convert HTML content to plain text and add leading space
    let plainText = htmlToPlainText(slide.content)

    // Add "Amin!" to the last slide
    if (isLastSlide && plainText && !/amin/i.test(plainText)) {
      plainText = `${plainText}\n\nAmin!`
    }

    const lyricLines = plainText.split('\n').filter((line) => line.trim())

    for (const line of lyricLines) {
      // OpenSong format: leading space before each lyric line
      lines.push(` ${line}`)
    }
  }

  return lines.join('\n')
}

/**
 * Generates OpenSong XML from a SongWithSlides object
 * This is the inverse of parseOpenSongXml
 */
export function generateOpenSongXml(song: SongWithSlides): string {
  const parts: string[] = []

  // XML declaration is optional but good practice
  parts.push('<?xml version="1.0" encoding="UTF-8"?>\n')
  parts.push('<song>\n')

  // Add metadata elements
  parts.push(xmlElement('title', song.title))
  parts.push(xmlElement('church_hub_id', String(song.id)))
  parts.push(xmlElement('author', song.author))
  parts.push(xmlElement('copyright', song.copyright))
  parts.push(xmlElement('ccli', song.ccli))
  parts.push(xmlElement('key', song.key))
  parts.push(xmlElement('tempo', song.tempo))
  parts.push(xmlElement('timesig', song.timeSignature))
  parts.push(xmlElement('theme', song.theme))
  parts.push(xmlElement('alttheme', song.altTheme))
  parts.push(xmlElement('hymn_number', song.hymnNumber))
  parts.push(xmlElement('key_line', song.keyLine))

  // Generate presentation order with chorus insertions (C1 V1 C1 V2 C1 V3 C2...)
  const presentationOrder = generateExpandedPresentationOrder(song.slides)
  parts.push(
    xmlElement('presentation', presentationOrder || song.presentationOrder),
  )

  // Generate lyrics section
  const lyrics = generateLyrics(song.slides)
  if (lyrics) {
    parts.push('  <lyrics>\n')
    parts.push(lyrics)
    parts.push('\n  </lyrics>\n')
  }

  parts.push('</song>\n')

  return parts.join('')
}
