import type { TemporaryContent } from './types'
import { passageKey } from '../bible/topics/getPassageTemplates'
import { getTopicTemplates } from '../bible/topics/getTopicTemplates'

const TOPIC_SLIDESHOW = /^topic:(\d+)$/

/** The topic a slideshow or a verse on screen was presented from, if any. */
export function presentedTopicId(content: TemporaryContent | null) {
  if (content?.type === 'bible') return content.data.topic?.topicId ?? null
  if (content?.type !== 'versete_tineri') return null
  const id = content.data.slideshow?.match(TOPIC_SLIDESHOW)?.[1]
  return id ? Number(id) : null
}

/**
 * What a Bible topic presents carries the templates it is drawn with, read
 * fresh on every change (T-902): a verse presented from a passage, its
 * passage's own or the topic's; the topic's slideshow, the topic's, and each
 * entry its passage's own. A template chosen while it is on screen reaches
 * the screens with the next update, whoever presented it.
 */
export function withTopicTemplates(
  content: TemporaryContent | null,
): TemporaryContent | null {
  const topicId = presentedTopicId(content)
  const templates = topicId ? getTopicTemplates(topicId) : null
  if (!content || !templates) return content
  if (content.type === 'bible') {
    const passage = content.data.topic?.passage
    const own = passage ? templates.passages.get(passageKey(passage)) : null
    return {
      ...content,
      data: { ...content.data, templateId: own ?? templates.templateId },
    }
  }
  if (content.type !== 'versete_tineri') return content
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
