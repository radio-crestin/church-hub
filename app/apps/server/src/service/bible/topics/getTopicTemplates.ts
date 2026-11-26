import {
  getFittingTopicTemplateId,
  getTopicTemplatePool,
} from './getFittingTopicTemplateId'
import { getPassageTemplates } from './getPassageTemplates'
import type { BibleTopicRecord } from './types'
import { getRawDatabase } from '../../../db'

export interface TopicTemplates {
  /** The topic's: the one chosen for it, else its fitting one. */
  templateId: number | null
  /** The passages drawn with their own, by passageKey. */
  passages: Map<string, number>
}

/** The templates a topic's verses are drawn with; null: no such topic. */
export function getTopicTemplates(topicId: number): TopicTemplates | null {
  const row = getRawDatabase()
    .query<Pick<BibleTopicRecord, 'key' | 'template_id'>, [number]>(
      'SELECT key, template_id FROM bible_topics WHERE id = ?',
    )
    .get(topicId)
  if (!row) return null
  return {
    templateId:
      row.template_id ??
      getFittingTopicTemplateId(row.key, getTopicTemplatePool()),
    passages: getPassageTemplates(topicId),
  }
}
