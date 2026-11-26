import type { PptxPackage } from './package/openPptxPackage'
import type { SlideDeck } from '../types'

/** Why something of a slide did not come in as PowerPoint shows it. */
export const PPTX_NOTE_REASONS = [
  'chart',
  'ole',
  'smartart',
  'table',
  'unsupportedPicture',
  'convertVideo',
  'unsupportedMedia',
  'linkedMedia',
  'playOnClick',
  'audio',
  'transition',
  'animation',
  'motionPath',
  'interactive',
  'shape',
  'gradient',
  'embeddedFonts',
  'mediaTooLarge',
  'uploadFailed',
  'hiddenSlide',
] as const
export type PptxNoteReason = (typeof PPTX_NOTE_REASONS)[number]

/**
 * One line of the import's summary: on which slide (none: the whole file),
 * what became of it (shown as a picture, left out, or changed), why, and the
 * shape's or effect's name (or how many effects).
 */
export interface PptxImportNote {
  slide?: number
  outcome: 'picture' | 'skipped' | 'changed'
  reason: PptxNoteReason
  detail?: string
  /** How many, for the notes that count effects. */
  count?: number
}

/** A picture or video of the file the deck refers to, uploaded after reading. */
export interface PptxMediaFile {
  /** What the deck has as its media id until it is uploaded. */
  token: string
  path: string
  kind: 'image' | 'video'
  fileName: string
  mimeType: string
}

/** A read file: its deck (media ids still tokens), its media and notes. */
export interface PptxParsedDeck {
  /** The file, to read its media from when uploading them. */
  pkg: PptxPackage
  deck: SlideDeck
  media: PptxMediaFile[]
  notes: PptxImportNote[]
}

/** How far an import is. */
export type PptxImportProgress =
  | { phase: 'reading' }
  | { phase: 'uploading'; done: number; total: number }

/** A finished import: the deck, ready to save, and its summary. */
export interface PptxImportResult {
  deck: SlideDeck
  notes: PptxImportNote[]
  pictures: number
  videos: number
}
