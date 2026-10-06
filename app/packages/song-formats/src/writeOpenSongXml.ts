/** OpenSong's own elements, plus ours: church_hub_id, hymn_number, key_line, source_filename. */
export type OpenSongField =
  | 'church_hub_id'
  | 'author'
  | 'copyright'
  | 'ccli'
  | 'key'
  | 'tempo'
  | 'timesig'
  | 'theme'
  | 'alttheme'
  | 'hymn_number'
  | 'key_line'
  | 'source_filename'
  | 'presentation'

/** One labelled block of the lyrics, e.g. [V1] and its lines. */
export interface OpenSongVerse {
  label: string | null
  lines: string[]
}

export interface OpenSongDocument {
  title: string
  fields: Partial<Record<OpenSongField, string | null | undefined>>
  verses: OpenSongVerse[]
}

const FIELD_ORDER: OpenSongField[] = [
  'church_hub_id',
  'author',
  'copyright',
  'ccli',
  'key',
  'tempo',
  'timesig',
  'theme',
  'alttheme',
  'hymn_number',
  'key_line',
  'source_filename',
  'presentation',
]

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlElement(tagName: string, value: string | null | undefined): string {
  if (!value) return ''
  return `  <${tagName}>${escapeXml(value)}</${tagName}>\n`
}

/** OpenSong lyrics: [LABEL] then each lyric line with a leading space. */
function writeLyrics(verses: OpenSongVerse[]): string {
  const lines: string[] = []
  for (const verse of verses) {
    if (verse.label) lines.push(`[${verse.label}]`)
    for (const line of verse.lines) {
      if (line.trim()) lines.push(` ${escapeXml(line)}`)
    }
  }
  return lines.join('\n')
}

/** An OpenSong XML file (the inverse of the client's parseOpenSongXml). */
export function writeOpenSongXml(doc: OpenSongDocument): string {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n', '<song>\n']
  parts.push(xmlElement('title', doc.title))
  for (const field of FIELD_ORDER)
    parts.push(xmlElement(field, doc.fields[field]))
  const lyrics = writeLyrics(doc.verses)
  if (lyrics) parts.push('  <lyrics>\n', lyrics, '\n  </lyrics>\n')
  parts.push('</song>\n')
  return parts.join('')
}
