import type { ContentType } from '../../types'

export interface ContentData {
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
}

export interface VerseteTineriSummaryEntry {
  personName: string
  reference: string
}

export interface NextSlideData {
  contentType: ContentType
  preview: string
  /** Type-specific label (e.g., "Cântare:", "Versete Tineri:", "Anunț:", "Pasaj Biblic:") */
  label?: string
  /** Title for content that has one (e.g., song title) */
  title?: string
  verseteTineriSummary?: {
    entries: VerseteTineriSummaryEntry[]
    hasMore: boolean
  }
}
