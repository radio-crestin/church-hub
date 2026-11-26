import { isTopicTemplate } from './checkTopicTemplate'
import type { BibleTopicReference } from './types'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('bible-topics')

export type SetPassageTemplateResult =
  | 'ok'
  | 'topic-not-found'
  | 'template-not-found'

/**
 * A topic's passage drawn with its own template; null: with the topic's.
 */
export function setBibleTopicPassageTemplate(
  topicId: number,
  passage: BibleTopicReference,
  templateId: number | null,
): SetPassageTemplateResult {
  const db = getRawDatabase()
  const topic = db
    .query<{ id: number }, [number]>('SELECT id FROM bible_topics WHERE id = ?')
    .get(topicId)
  if (!topic) return 'topic-not-found'
  const { book, chapter, startVerse, endVerse } = passage
  if (templateId === null) {
    db.run(
      `DELETE FROM bible_topic_passage_templates
        WHERE topic_id = ? AND book = ? AND chapter = ? AND start_verse = ? AND end_verse = ?`,
      [topicId, book, chapter, startVerse, endVerse],
    )
  } else {
    if (!isTopicTemplate(templateId)) return 'template-not-found'
    db.run(
      `INSERT INTO bible_topic_passage_templates
        (topic_id, book, chapter, start_verse, end_verse, template_id)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (topic_id, book, chapter, start_verse, end_verse)
        DO UPDATE SET template_id = excluded.template_id`,
      [topicId, book, chapter, startVerse, endVerse, templateId],
    )
  }
  logger.info(
    `Topic ${topicId}, ${book} ${chapter}:${startVerse}-${endVerse} → template ${templateId ?? 'the topic’s'}`,
  )
  return 'ok'
}
