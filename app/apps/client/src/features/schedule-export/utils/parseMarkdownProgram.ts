import type { ChurchProgramData, ExportedScheduleItem } from '../types'

const TITLE = /^#\s+(.*)$/
const HEADING = /^##\s+(.*)$/
const SLIDE_HEADING = /^###\s/
/** A Bible Marcaje heading: `Ioan 3:16-18 - VDC`. */
const BIBLE_HEADING =
  /^(.*\d+:\d+(?:\s*-\s*\d+(?::\d+)?)?)\s+-\s+([\p{L}\d]+)$/u
const SONG_ID = /\s*\{#song-\d+\}\s*$/
const QUOTE_NOTE = /^>\s?(.*)$/
const DASHED_NOTE = /^-{3,}\s*(.*?)\s*-{3,}$/
const LIST_MARKER = /^(?:[-*+]|\d+[.)])\s+/
/** The song export's `*Category · key line*` line under its heading. */
const DETAILS = /^\*[^*\s].*\*$/

/**
 * Turns a Markdown list into a presentation, the way the song and Bible
 * Marcaje export it (and the way someone would type one):
 *
 *   # Duminică dimineața            the presentation's title
 *   ## Cât de mare ești {#song-12}  a song (`- title` or a bare line too)
 *   ## Ioan 3:16 - VDC              a Bible passage, in that translation
 *   > Bun venit!                    a note, shown as an announcement slide
 *
 * The lyrics and verse text the exports write under a heading are skipped:
 * songs and passages are looked up in the library when the file is loaded.
 * Pure text handling.
 */
export function parseMarkdownProgram(
  text: string,
  fallbackTitle: string,
): ChurchProgramData {
  const items: ExportedScheduleItem[] = []
  let title = fallbackTitle
  /** Lines under a heading that are its lyrics or verse text. */
  let inBody = false
  /** Right under a song heading, before anything else. */
  let underSong = false

  const push = (item: Omit<ExportedScheduleItem, 'sortOrder'>) =>
    items.push({ ...item, sortOrder: items.length })

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const titleMatch = trimmed.match(TITLE)
    if (titleMatch) {
      if (items.length === 0) title = plainText(titleMatch[1]) || title
      inBody = false
      underSong = false
      continue
    }

    const heading = trimmed.match(HEADING)
    if (heading) {
      const bible = plainText(heading[1]).match(BIBLE_HEADING)
      if (bible) {
        push(biblePassage(bible[1].trim(), bible[2]))
        inBody = true
        underSong = false
      } else {
        push(song(heading[1]))
        inBody = false
        underSong = true
      }
      continue
    }

    const note = readNote(trimmed)
    if (note !== null) {
      if (note) push(announcement(note))
      inBody = false
      underSong = false
      continue
    }

    if (SLIDE_HEADING.test(trimmed) || (underSong && DETAILS.test(trimmed))) {
      inBody = true
      continue
    }
    if (inBody || trimmed.startsWith('#')) continue

    underSong = false
    push(song(trimmed.replace(LIST_MARKER, '')))
  }

  return {
    version: 1,
    type: 'churchprogram',
    schedule: { title, description: null },
    items,
  }
}

/** A note's text, '' for a bare `---` separator, or null for any other line. */
function readNote(line: string): string | null {
  const quote = line.match(QUOTE_NOTE)
  if (quote) return quote[1].trim()
  const dashed = line.match(DASHED_NOTE)
  if (dashed) return dashed[1].trim()
  if (/^-{3,}$/.test(line)) return ''
  return null
}

/** Markdown inline text without its styling and escapes. */
function plainText(markdown: string): string {
  return markdown
    .replace(/<\/?(?:u|mark)>/g, '')
    .replace(/(\*\*|__|\*|_)(?=\S)(.+?)(?<=\S)\1/g, '$2')
    .replace(/\\(.)/g, '$1')
    .trim()
}

function song(markdown: string): Omit<ExportedScheduleItem, 'sortOrder'> {
  return {
    itemType: 'song',
    song: {
      title: plainText(markdown.replace(SONG_ID, '')),
      author: null,
      copyright: null,
      ccli: null,
      key: null,
      tempo: null,
      slides: [],
    },
  }
}

function biblePassage(
  reference: string,
  translationAbbreviation: string,
): Omit<ExportedScheduleItem, 'sortOrder'> {
  // No verse ids: the import finds the passage by reference and translation.
  return {
    itemType: 'bible_passage',
    biblePassage: { reference, translationAbbreviation, verses: [] },
  }
}

function announcement(
  markdown: string,
): Omit<ExportedScheduleItem, 'sortOrder'> {
  return {
    itemType: 'slide',
    slideType: 'announcement',
    slideContent: `<p>${escapeHtml(plainText(markdown))}</p>`,
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
