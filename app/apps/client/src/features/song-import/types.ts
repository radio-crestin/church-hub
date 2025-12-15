import type { ParsedPptx } from './utils/parsePptx'

export interface ExtractedPptxFile {
  filename: string
  data: ArrayBuffer
  sourcePath: string
}

export interface ExtractedPptFile {
  filename: string
  data: ArrayBuffer
  sourcePath: string
}

export interface ExtractedOpenSongFile {
  filename: string
  content: string
  sourcePath: string
}

export interface ExtractResult {
  pptxFiles: ExtractedPptxFile[]
  pptFiles: ExtractedPptFile[]
  opensongFiles: ExtractedOpenSongFile[]
  errors: string[]
}

export interface ImportProgress {
  phase: 'downloading' | 'extracting' | 'converting' | 'parsing' | 'saving'
  current: number
  total: number | null
  currentFile?: string
}

/**
 * Parsed slide with optional label (V1, C, etc.)
 */
export interface ParsedSlideWithLabel {
  slideNumber: number
  text: string
  htmlContent: string
  label?: string | null
}

/**
 * OpenSong metadata fields
 */
export interface OpenSongMetadata {
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
}

/**
 * Parsed song with optional metadata
 */
export interface ParsedSong {
  title: string
  slides: ParsedSlideWithLabel[]
  metadata?: OpenSongMetadata
}

export interface ProcessedImport {
  parsed: ParsedPptx | ParsedSong
  sourceFilename: string | null
  sourceFormat: 'pptx' | 'opensong'
}

export interface ProcessImportResult {
  songs: ProcessedImport[]
  errors: string[]
}

export interface BatchImportInput {
  songs: Array<{
    title: string
    slides: Array<{
      content: string
      sortOrder: number
      label?: string | null
    }>
    sourceFilename: string | null
    // OpenSong metadata
    author?: string | null
    copyright?: string | null
    ccli?: string | null
    key?: string | null
    tempo?: string | null
    timeSignature?: string | null
    theme?: string | null
    altTheme?: string | null
    hymnNumber?: string | null
    keyLine?: string | null
    presentationOrder?: string | null
  }>
  categoryId: number | null
}

export interface BatchImportResult {
  successCount: number
  failedCount: number
  skippedCount: number
  songIds: number[]
}

export interface ImportOptions {
  overwriteDuplicates: boolean
  useFirstVerseAsTitle: boolean
  skipManuallyEdited: boolean
}
