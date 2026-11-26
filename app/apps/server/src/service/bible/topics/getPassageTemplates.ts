import type { BibleTopicReference } from './types'
import { getRawDatabase } from '../../../db'

interface PassageTemplateRow {
  book: string
  chapter: number
  start_verse: number
  end_verse: number
  template_id: number
}

export function passageKey(ref: BibleTopicReference): string {
  return `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`
}

/** The passages of a topic drawn with their own template, by passageKey. */
export function getPassageTemplates(topicId: number): Map<string, number> {
  const rows = getRawDatabase()
    .query<PassageTemplateRow, [number]>(
      `SELECT book, chapter, start_verse, end_verse, template_id
        FROM bible_topic_passage_templates WHERE topic_id = ?`,
    )
    .all(topicId)
  return new Map(
    rows.map((row) => [
      passageKey({
        book: row.book,
        chapter: row.chapter,
        startVerse: row.start_verse,
        endVerse: row.end_verse,
      }),
      row.template_id,
    ]),
  )
}
