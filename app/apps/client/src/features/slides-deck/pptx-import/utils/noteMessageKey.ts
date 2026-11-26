import type { PptxImportNote } from '../types'

const STANDS_IN = new Set(['chart', 'ole', 'smartart'])
const ABOUT_BACKGROUND = new Set([
  'gradient',
  'unsupportedPicture',
  'linkedMedia',
])

/**
 * The summary line's message (`slidesImport.reasons.<key>`): a chart, OLE
 * object or SmartArt left out says so; a background's own wording when the
 * note is about the slide's background (it has no shape name).
 */
export function noteMessageKey(note: PptxImportNote): string {
  if (note.outcome === 'skipped' && STANDS_IN.has(note.reason)) {
    return `${note.reason}Skipped`
  }
  if (!note.detail && ABOUT_BACKGROUND.has(note.reason)) {
    return `${note.reason}Background`
  }
  return note.reason
}
