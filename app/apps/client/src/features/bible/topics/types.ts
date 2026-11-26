import type { BibleVerse } from '../types'

export interface BibleTopic {
  id: number
  key: string
  titleEn: string
  titleRo: string
  referenceCount: number
  /** The template it draws with: the one chosen for it, else its fitting one. */
  templateId: number | null
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
  /** Its own slide template; null: the topic's. */
  templateId: number | null
}

export interface BibleTopicWithPassages extends BibleTopic {
  translationId: number
  passages: BibleTopicPassage[]
}
