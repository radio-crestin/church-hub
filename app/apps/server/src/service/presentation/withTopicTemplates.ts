import type { TemporaryContent } from './types'
import { passageKey } from '../bible/topics/getPassageTemplates'
import { getTopicTemplates } from '../bible/topics/getTopicTemplates'

const TOPIC_SLIDESHOW = /^topic:(\d+)$/

/**
 * A Bible topic's slideshow carries the templates its verses are drawn with,
 * read fresh on every change (T-902): the topic's, and each passage's own.
 * A template chosen while it plays reaches the screens with the next
 * update, whoever presented it.
 */
export function withTopicTemplates(
  content: TemporaryContent | null,
): TemporaryContent | null {
  if (content?.type !== 'versete_tineri') return content
  const topicId = content.data.slideshow?.match(TOPIC_SLIDESHOW)?.[1]
  const templates = topicId ? getTopicTemplates(Number(topicId)) : null
  if (!templates) return content
  return {
    ...content,
    data: {
      ...content.data,
      templateId: templates.templateId,
      entries: content.data.entries.map((entry) => ({
        ...entry,
        templateId:
          templates.passages.get(
            passageKey({
              book: entry.bookCode,
              chapter: entry.startChapter,
              startVerse: entry.startVerse,
              endVerse: entry.endVerse,
            }),
          ) ?? null,
      })),
    },
  }
}
