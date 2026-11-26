import type { BibleTopicRecord, BibleTopicReference } from './types'
import { getRawDatabase } from '../../../db'

/** A topic's references by its stable key; empty when there is no such topic. */
export function getBibleTopicReferences(key: string): BibleTopicReference[] {
  const row = getRawDatabase()
    .query<Pick<BibleTopicRecord, 'verse_references'>, [string]>(
      'SELECT verse_references FROM bible_topics WHERE key = ?',
    )
    .get(key)
  return row ? (JSON.parse(row.verse_references) as BibleTopicReference[]) : []
}
