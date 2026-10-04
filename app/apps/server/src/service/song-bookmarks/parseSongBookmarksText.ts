import { parseStyledMarkdown } from '../bookmark-markdown'

/** One line of the Marcaje text recognised as a song or a note. */
export type ParsedSongBookmarkLine =
  | {
      kind: 'song'
      line: number
      /** The line as written, for error reports. */
      content: string
      title: string
      /** From a `{#song-12}` heading attribute, when present. */
      songId?: number
    }
  | { kind: 'note'; line: number; content: string }

const HEADING = /^##\s+(.*)$/
const SONG_ID = /\s*\{#song-(\d+)\}\s*$/
const QUOTE_NOTE = /^>\s?(.*)$/
const DASHED_NOTE = /^-{3,}\s*(.*?)\s*-{3,}$/
const LIST_MARKER = /^(?:[-*+]|\d+[.)])\s+/
const SLIDE_HEADING = /^###\s/
/** The export's `*Category · key line*` line under a song heading. */
const DETAILS = /^\*[^*\s].*\*$/

/**
 * Reads the song Marcaje as Markdown, the format the export writes and the
 * text editor shows:
 *
 *   ## Cât de mare ești {#song-12}   a song; the id picks the exact song
 *   Har minunat                      a song by its title (`- title` too)
 *   > Final                          a note (`--- note ---` too)
 *
 * The full export writes each slide under a `### Strofa 1` heading, after an
 * optional `*Category · key line*` line: from either of those on, lines are
 * lyrics and are skipped up to the next song heading or note. A blank line
 * changes nothing, so a title typed after one is never lost. Other headings
 * (`# title`) are skipped. Pure text handling.
 */
export function parseSongBookmarksText(text: string): ParsedSongBookmarkLine[] {
  const results: ParsedSongBookmarkLine[] = []
  const lines = text.split(/\r?\n/)
  /** No song or note line since the last song heading. */
  let underHeading = false
  let inLyrics = false

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    const heading = trimmed.match(HEADING)
    if (heading) {
      results.push(toSong(heading[1], trimmed, lineNumber))
      underHeading = true
      inLyrics = false
      continue
    }

    const note = readNote(trimmed)
    if (note !== null) {
      underHeading = false
      inLyrics = false
      if (note) results.push({ kind: 'note', line: lineNumber, content: note })
      continue
    }

    if (
      SLIDE_HEADING.test(trimmed) ||
      (underHeading && DETAILS.test(trimmed))
    ) {
      inLyrics = true
      continue
    }
    if (inLyrics || trimmed.startsWith('#')) continue

    underHeading = false
    results.push(toSong(trimmed.replace(LIST_MARKER, ''), trimmed, lineNumber))
  }

  return results
}

/**
 * The text of a note line, '' for a bare `---` separator, or null when the
 * line is not a note.
 */
function readNote(line: string): string | null {
  const quote = line.match(QUOTE_NOTE)
  if (quote) return quote[1].trim()
  const dashed = line.match(DASHED_NOTE)
  if (dashed) return dashed[1].trim()
  if (/^-{3,}$/.test(line)) return ''
  return null
}

function toSong(
  markdown: string,
  content: string,
  line: number,
): Extract<ParsedSongBookmarkLine, { kind: 'song' }> {
  const id = markdown.match(SONG_ID)
  const titleMarkdown = id ? markdown.slice(0, id.index) : markdown
  return {
    kind: 'song',
    line,
    content,
    // Unescapes `\*` and drops any styling a title was typed with
    title: parseStyledMarkdown(titleMarkdown.trim()).text.trim(),
    songId: id ? Number(id[1]) : undefined,
  }
}
