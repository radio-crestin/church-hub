import { isTopicTemplate } from './checkTopicTemplate'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('bible-topics')

export type SetTopicTemplateResult =
  | 'ok'
  | 'topic-not-found'
  | 'template-not-found'

/** The template a topic draws with; null: its fitting default again. */
export function setBibleTopicTemplate(
  topicId: number,
  templateId: number | null,
): SetTopicTemplateResult {
  if (templateId !== null && !isTopicTemplate(templateId)) {
    return 'template-not-found'
  }
  const updated = getRawDatabase().run(
    'UPDATE bible_topics SET template_id = ?, updated_at = unixepoch() WHERE id = ?',
    [templateId, topicId],
  )
  if (updated.changes === 0) return 'topic-not-found'
  logger.info(`Topic ${topicId} → template ${templateId ?? 'its fitting one'}`)
  return 'ok'
}
