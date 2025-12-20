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
  verseteTineriSummary?: {
    entries: VerseteTineriSummaryEntry[]
    hasMore: boolean
  }
}
