import { decodeHtmlEntities } from './decodeHtmlEntities'
import { sanitizeSongTitle } from './sanitizeSongTitle'
import type {
  OpenSongMetadata,
  ParsedOpenSong,
  ParsedOpenSongVerse,
  ParsedSlideWithLabel,
} from './sourceSongTypes'
import { stripFormattingTags } from './stripFormattingTags'

const VERSE_LABEL = /^\[([A-Z]\d*)\]$/

function fileNameWithoutExtension(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() || filePath
  return name.replace(/\.[^.]+$/, '')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** The text of an element (`<title>…</title>`), as an XML reader gives it. */
function elementText(xml: string, tagName: string): string {
  const match = xml.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`),
  )
  if (!match) return ''
  const content = match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, cdata: string) =>
      cdata.replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    )
    .replace(/<!--[\s\S]*?-->/g, '')
    // Markup inside the element (a stray <br />) is not text.
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n?/g, '\n')
  return decodeHtmlEntities(content)
}

/** An element's text without formatting tags (`<i>Cântare</i>`), or null. */
function field(xml: string, tagName: string): string | null {
  return stripFormattingTags(elementText(xml, tagName)).trim() || null
}

function readMetadata(xml: string): OpenSongMetadata {
  const churchHubId = field(xml, 'church_hub_id')
  return {
    author: field(xml, 'author'),
    copyright: field(xml, 'copyright'),
    ccli: field(xml, 'ccli'),
    tempo: field(xml, 'tempo'),
    timeSignature: field(xml, 'timesig'),
    theme: field(xml, 'theme'),
    altTheme: field(xml, 'alttheme'),
    hymnNumber: field(xml, 'hymn_number'),
    keyLine: field(xml, 'key_line'),
    presentationOrder: field(xml, 'presentation'),
    churchHubId: churchHubId ? Number.parseInt(churchHubId, 10) : null,
    sourceFilename: field(xml, 'source_filename'),
  }
}

/**
 * OpenSong lyrics as verses: `[V1]`, `[C]`, `[B1]`… start a verse; lyric
 * lines start with a space.
 */
function parseLyrics(lyrics: string): ParsedOpenSongVerse[] {
  const verses: ParsedOpenSongVerse[] = []
  let current: ParsedOpenSongVerse | null = null
  for (const line of lyrics.split('\n')) {
    const label = line.trim().match(VERSE_LABEL)
    if (label) {
      if (current && current.lines.length > 0) verses.push(current)
      current = { label: label[1], lines: [] }
      continue
    }
    const text = (line.startsWith(' ') ? line.substring(1) : line).trim()
    if (current && text) current.lines.push(text)
  }
  if (current && current.lines.length > 0) verses.push(current)
  return verses
}

/** Slides in the presentation order, or in the verses' own order. */
function toSlides(
  verses: ParsedOpenSongVerse[],
  presentationOrder: string | null,
): ParsedSlideWithLabel[] {
  const byLabel = new Map(verses.map((verse) => [verse.label, verse]))
  const order = presentationOrder?.trim()
    ? presentationOrder.trim().split(/\s+/)
    : verses.map((verse) => verse.label)
  const slides: ParsedSlideWithLabel[] = []
  for (const label of order) {
    const verse = byLabel.get(label)
    if (!verse) continue
    slides.push({
      slideNumber: slides.length + 1,
      text: verse.lines.join('\n'),
      htmlContent: verse.lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join(''),
      label: verse.label,
    })
  }
  return slides
}

/**
 * Reads an OpenSong song. No XML parser is needed (OpenSong is one flat
 * `<song>` element), so it works the same in the browser, on the server and
 * in a worker, and forgives what strict XML refuses, such as a bare "&".
 */
export function parseOpenSongXml(
  xml: string,
  filename?: string,
  /** Keep the title as written: Church Hub's own song files, not foreign ones. */
  { exactTitle = false }: { exactTitle?: boolean } = {},
): ParsedOpenSong {
  if (!/<song[\s>]/.test(xml)) {
    throw new Error('Invalid OpenSong file: missing <song> element')
  }
  const rawTitle =
    field(xml, 'title') ||
    (filename ? fileNameWithoutExtension(filename) : 'Untitled Song')
  const metadata = readMetadata(xml)
  const verses = parseLyrics(stripFormattingTags(elementText(xml, 'lyrics')))
  return {
    title: exactTitle ? rawTitle.trim() : sanitizeSongTitle(rawTitle),
    slides: toSlides(verses, metadata.presentationOrder),
    metadata,
    verses,
  }
}
