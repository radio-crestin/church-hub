import { fetcher } from '~/utils/fetcher'
import type { BibleTopicPassage } from '../types'

/** A topic's passage drawn with its own template; null: with the topic's. */
export async function setPassageTemplate(
  topicId: number,
  passage: Pick<
    BibleTopicPassage,
    'book' | 'chapter' | 'startVerse' | 'endVerse'
  >,
  templateId: number | null,
): Promise<void> {
  const { book, chapter, startVerse, endVerse } = passage
  await fetcher(`/api/bible/topics/${topicId}/passage-template`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book, chapter, startVerse, endVerse, templateId }),
  })
}
