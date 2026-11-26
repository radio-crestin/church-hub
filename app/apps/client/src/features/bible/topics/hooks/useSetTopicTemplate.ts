import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BIBLE_TOPICS_QUERY_KEY } from './useBibleTopics'
import { setTopicTemplate } from '../service/setTopicTemplate'
import type { BibleTopic, BibleTopicWithPassages } from '../types'

/** The template a topic draws with, remembered for it and shown at once. */
export function useSetTopicTemplate(topicId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (templateId: number | null) =>
      setTopicTemplate(topicId, templateId),
    onMutate: (templateId) => {
      queryClient.setQueryData<BibleTopic[]>(BIBLE_TOPICS_QUERY_KEY, (topics) =>
        topics?.map((topic) =>
          topic.id === topicId ? { ...topic, templateId } : topic,
        ),
      )
      queryClient.setQueriesData<BibleTopicWithPassages>(
        { queryKey: [...BIBLE_TOPICS_QUERY_KEY, topicId] },
        (topic) => topic && { ...topic, templateId },
      )
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: BIBLE_TOPICS_QUERY_KEY }),
  })
}
