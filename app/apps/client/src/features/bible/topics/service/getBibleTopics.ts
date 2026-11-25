import { fetcher } from '~/utils/fetcher'
import type { BibleTopic, BibleTopicWithPassages } from '../types'

export async function getBibleTopics(): Promise<BibleTopic[]> {
  const response = await fetcher<{ data: BibleTopic[] }>('/api/bible/topics')
  return response.data
}

/** A topic with its passages in the translation. */
export async function getBibleTopic(
  topicId: number,
  translationId: number,
): Promise<BibleTopicWithPassages> {
  const response = await fetcher<{ data: BibleTopicWithPassages }>(
    `/api/bible/topics/${topicId}?translationId=${translationId}`,
  )
  return response.data
}
