import type { BibleTopic, BibleTopicRecord } from './types'
import { getRawDatabase } from '../../../db'

export function toBibleTopic(row: BibleTopicRecord): BibleTopic {
  return {
    id: row.id,
    key: row.key,
    titleEn: row.title_en,
    titleRo: row.title_ro,
    referenceCount: (JSON.parse(row.verse_references) as unknown[]).length,
  }
}

/** Every topic, in the order they were added (the bundled order first). */
export function listBibleTopics(): BibleTopic[] {
  return getRawDatabase()
    .query<BibleTopicRecord, []>('SELECT * FROM bible_topics ORDER BY id')
    .all()
    .map(toBibleTopic)
}
