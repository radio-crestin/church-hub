import type { BibleVerse } from '../types'

export interface BibleTopic {
  id: number
  key: string
  titleEn: string
  titleRo: string
  referenceCount: number
}

/** One of a topic's references, resolved in a translation. */
export interface BibleTopicPassage {
  book: string
  chapter: number
  startVerse: number
  endVerse: number
  /** e.g. "Ioan 3:16-17", in the translation's book names */
  reference: string
  verses: BibleVerse[]
}

export interface BibleTopicWithPassages extends BibleTopic {
  translationId: number
  passages: BibleTopicPassage[]
}
