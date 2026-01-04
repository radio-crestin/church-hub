import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { addToHistory, clearHistory, getHistory } from '../service'
import type { AddToHistoryInput, BibleHistoryItem } from '../types'

export const BIBLE_HISTORY_QUERY_KEY = ['bible-history']

export function useBibleHistory() {
  return useQuery<BibleHistoryItem[]>({
    queryKey: BIBLE_HISTORY_QUERY_KEY,
    queryFn: getHistory,
  })
}

export function useAddToHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddToHistoryInput) => addToHistory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BIBLE_HISTORY_QUERY_KEY })
    },
  })
}

export function useClearHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BIBLE_HISTORY_QUERY_KEY })
    },
  })
}
