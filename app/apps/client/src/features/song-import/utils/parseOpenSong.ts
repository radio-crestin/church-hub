import { sanitizeSongTitle } from './sanitizeTitle'
import type {
  OpenSongMetadata,
  ParsedSlideWithLabel,
  ParsedSong,
} from '../types'

/**
 * Represents a parsed verse from OpenSong lyrics
 */
export interface OpenSongVerse {
  label: string // V1, V2, C, C1, B, P, T, etc.
  lines: string[]
}

/**
 * Result of parsing OpenSong XML
 */
export interface ParsedOpenSong extends ParsedSong {
  verses: OpenSongVerse[]
}

/**
 * Extracts filename without extension from a path or filename
 */
function extractFilenameWithoutExtension(filePath: string): string {
  const filename = filePath.split(/[/\\]/).pop() || filePath
  return filename.replace(/\.[^.]+$/, '')
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Gets text content from an XML element, returning null if empty
 */
function getTextContent(song: Element, tagName: string): string | null {
  const element = song.querySelector(tagName)
  const text = element?.textContent?.trim()
  return text || null
}

/**
 * Extracts metadata from OpenSong XML
 */
function extractMetadata(
  song: Element,
  filename?: string,
): { title: string; metadata: OpenSongMetadata } {
  const rawTitle =
    getTextContent(song, 'title') ||
    (filename ? extractFilenameWithoutExtension(filename) : 'Untitled Song')
  const title = sanitizeSongTitle(rawTitle)

  const churchHubIdStr = getTextContent(song, 'church_hub_id')
  const metadata: OpenSongMetadata = {
    author: getTextContent(song, 'author'),
    copyright: getTextContent(song, 'copyright'),
    ccli: getTextContent(song, 'ccli'),
    key: getTextContent(song, 'key'),
    tempo: getTextContent(song, 'tempo'),
    timeSignature: getTextContent(song, 'timesig'),
    theme: getTextContent(song, 'theme'),
    altTheme: getTextContent(song, 'alttheme'),
    hymnNumber: getTextContent(song, 'hymn_number'),
    keyLine: getTextContent(song, 'key_line'),
    presentationOrder: getTextContent(song, 'presentation'),
    churchHubId: churchHubIdStr ? parseInt(churchHubIdStr, 10) : null,
  }

  return { title, metadata }
}

/**
 * Parses the lyrics section into verses
 * OpenSong format uses [V1], [C], [B1], etc. as verse labels
 * and leading space for lyric lines
 */
function parseLyrics(lyricsText: string): OpenSongVerse[] {
  const verses: OpenSongVerse[] = []
  const lines = lyricsText.split('\n')

  let currentVerse: OpenSongVerse | null = null

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Check for verse label pattern: [V1], [C], [B1], [P], [T], etc.
    // Supports: V (verse), C (chorus), B (bridge), P (pre-chorus), T (tag), E (ending)
    // Can have optional numbers: V1, V2, C1, C2, B1, etc.
    const labelMatch = trimmedLine.match(/^\[([A-Z]\d*)\]$/)

    if (labelMatch) {
      // Save previous verse if exists and has content
      if (currentVerse && currentVerse.lines.length > 0) {
        verses.push(currentVerse)
      }
      // Start new verse
      currentVerse = {
        label: labelMatch[1],
        lines: [],
      }
    } else if (currentVerse) {
      // OpenSong uses leading space for lyrics lines
      // Remove leading space and add to current verse if not empty
      const cleanLine = line.startsWith(' ') ? line.substring(1) : line
      const finalLine = cleanLine.trim()
      if (finalLine) {
        currentVerse.lines.push(finalLine)
      }
    }
  }

  // Don't forget the last verse
  if (currentVerse && currentVerse.lines.length > 0) {
    verses.push(currentVerse)
  }

  return verses
}

/**
 * Creates slides based on presentation order
 * If no presentation order is specified, uses verses in their natural order
 */
function createSlidesFromPresentation(
  verses: OpenSongVerse[],
  presentationOrder: string | null,
): ParsedSlideWithLabel[] {
  const slides: ParsedSlideWithLabel[] = []

  // Create a map of verse labels to verses for quick lookup
  const verseMap = new Map<string, OpenSongVerse>()
  for (const verse of verses) {
    verseMap.set(verse.label, verse)
  }

  // Determine order: use presentation order if specified, otherwise use natural verse order
  let orderLabels: string[]

  if (presentationOrder && presentationOrder.trim()) {
    orderLabels = presentationOrder.trim().split(/\s+/)
  } else {
    orderLabels = verses.map((v) => v.label)
  }

  let slideNumber = 1
  for (const label of orderLabels) {
    const verse = verseMap.get(label)
    if (verse) {
      const text = verse.lines.join('\n')
      const htmlContent = verse.lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')

      slides.push({
        slideNumber,
        text,
        htmlContent,
        label: verse.label,
      })
      slideNumber++
    }
  }

  return slides
}

/**
 * Checks if content appears to be OpenSong XML format
 * OpenSong files start with <song> element and contain <lyrics>
 */
export function isOpenSongXml(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith('<song') && trimmed.includes('<lyrics>')
}

/**
 * Parses OpenSong XML content
 * @param xmlContent - The XML content as string
 * @param filename - Optional filename to use as fallback title
 */
export function parseOpenSongXml(
  xmlContent: string,
  filename?: string,
): ParsedOpenSong {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'application/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent}`)
  }

  const song = doc.querySelector('song')
  if (!song) {
    throw new Error('Invalid OpenSong file: missing <song> element')
  }

  // Extract metadata
  const { title, metadata } = extractMetadata(song, filename)

  // Extract and parse lyrics
  const lyricsElement = song.querySelector('lyrics')
  const lyricsText = lyricsElement?.textContent || ''
  const verses = parseLyrics(lyricsText)

  // Create slides based on presentation order
  const slides = createSlidesFromPresentation(
    verses,
    metadata.presentationOrder,
  )

  return {
    title,
    slides,
    metadata,
    verses,
  }
}
