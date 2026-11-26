import type { BibleVerse } from '../types'

/** A verse range in one chapter, by the app's book code (`JHN`, `1CO`, …). */
export interface BibleTopicReference {
  book: string
  chapter: number
  startVerse: number
  endVerse: number
}

/** A topic as bundled in default-bible-topics.json */
export interface BibleTopicFixture {
  key: string
  titleEn: string
  titleRo: string
  references: BibleTopicReference[]
}

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
export interface BibleTopicPassage extends BibleTopicReference {
  /** e.g. "Ioan 3:16-17", with the translation's book name */
  reference: string
  verses: BibleVerse[]
  /** Its own slide template; null: the topic's. */
  templateId: number | null
}

export interface BibleTopicWithPassages extends BibleTopic {
  translationId: number
  passages: BibleTopicPassage[]
}

export interface BibleTopicRecord {
  id: number
  key: string
  title_en: string
  title_ro: string
  verse_references: string
  fixture_hash: string | null
  template_id: number | null
}
