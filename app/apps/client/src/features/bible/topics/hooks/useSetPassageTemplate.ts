import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BIBLE_TOPICS_QUERY_KEY } from './useBibleTopics'
import { setPassageTemplate } from '../service/setPassageTemplate'
import type { BibleTopicPassage, BibleTopicWithPassages } from '../types'

function isSamePassage(a: BibleTopicPassage, b: BibleTopicPassage) {
  return (
    a.book === b.book &&
    a.chapter === b.chapter &&
    a.startVerse === b.startVerse &&
    a.endVerse === b.endVerse
  )
}

/** A passage's own template, shown on its row at once. */
export function useSetPassageTemplate(topicId: number) {
  const queryClient = useQueryClient()
  const topicKey = [...BIBLE_TOPICS_QUERY_KEY, topicId]
  return useMutation({
    mutationFn: ({
      passage,
      templateId,
    }: {
      passage: BibleTopicPassage
      templateId: number | null
    }) => setPassageTemplate(topicId, passage, templateId),
    onMutate: ({ passage, templateId }) => {
      queryClient.setQueriesData<BibleTopicWithPassages>(
        { queryKey: topicKey },
        (topic) =>
          topic && {
            ...topic,
            passages: topic.passages.map((each) =>
              isSamePassage(each, passage) ? { ...each, templateId } : each,
            ),
          },
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: topicKey }),
  })
}
