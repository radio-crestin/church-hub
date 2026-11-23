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

/**
 * Where an element's content starts and ends (`<title>` … `</title>`), or
 * null. Scans with indexOf: a regex over the whole file backtracks
 * quadratically on a pathological one (many `<title ` with no `>`).
 */
function findElement(
  xml: string,
  tagName: string,
): { start: number; end: number } | null {
  const opening = `<${tagName}`
  let index = xml.indexOf(opening)
  while (index !== -1) {
    const next = xml[index + opening.length] ?? ''
    if (next === '>' || /\s/.test(next)) {
      const openEnd = xml.indexOf('>', index + opening.length)
      if (openEnd === -1) return null
      const end = xml.indexOf(`</${tagName}>`, openEnd + 1)
      return end === -1 ? null : { start: openEnd + 1, end }
    }
    index = xml.indexOf(opening, index + 1)
  }
  return null
}

/**
 * An element's content as text: CDATA kept (escaped, so it is never read as
 * markup), comments and any markup inside (a stray `<br />`) dropped. One
 * linear pass, so nothing it removes can join into new markup.
 */
function contentText(content: string): string {
  let text = ''
  let index = 0
  // Once a terminator is missing, it is missing for the rest of the text too.
  let cdataCloses = true
  let commentCloses = true
  while (index < content.length) {
    const open = content.indexOf('<', index)
    if (open === -1) break
    text += content.slice(index, open)
    if (cdataCloses && content.startsWith('<![CDATA[', open)) {
      const close = content.indexOf(']]>', open + 9)
      if (close !== -1) {
        text += content
          .slice(open + 9, close)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
        index = close + 3
        continue
      }
      cdataCloses = false
    }
    if (commentCloses && content.startsWith('<!--', open)) {
      const close = content.indexOf('-->', open + 4)
      if (close !== -1) {
        index = close + 3
        continue
      }
      commentCloses = false
    }
    const close = content.indexOf('>', open)
    if (close === -1) {
      index = open
      break
    }
    index = close + 1
  }
  return text + content.slice(index)
}

/** The text of an element (`<title>…</title>`), as an XML reader gives it. */
function elementText(xml: string, tagName: string): string {
  const element = findElement(xml, tagName)
  if (!element) return ''
  const content = contentText(xml.slice(element.start, element.end))
  return decodeHtmlEntities(content.replace(/\r\n?/g, '\n'))
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
