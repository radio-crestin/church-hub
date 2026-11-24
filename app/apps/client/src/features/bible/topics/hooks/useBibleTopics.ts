import { useQuery } from '@tanstack/react-query'

import { getBibleTopic, getBibleTopics } from '../service/getBibleTopics'

export const BIBLE_TOPICS_QUERY_KEY = ['bible', 'topics'] as const

export function useBibleTopics() {
  return useQuery({
    queryKey: BIBLE_TOPICS_QUERY_KEY,
    queryFn: getBibleTopics,
    staleTime: 10 * 60 * 1000,
  })
}

/** A topic's passages in the translation. */
export function useBibleTopic(
  topicId: number | null,
  translationId: number | undefined,
) {
  return useQuery({
    queryKey: [...BIBLE_TOPICS_QUERY_KEY, topicId, translationId],
    queryFn: () => getBibleTopic(topicId!, translationId!),
    enabled: topicId !== null && !!translationId,
    staleTime: 10 * 60 * 1000,
  })
}
