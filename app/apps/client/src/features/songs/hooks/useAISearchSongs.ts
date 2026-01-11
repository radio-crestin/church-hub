import { useMutation } from '@tanstack/react-query'

import { aiSearchSongs } from '../service'
import type { AISearchResponse } from '../types'

interface AISearchInput {
  query: string
  categoryIds?: number[]
}

export function useAISearchSongs() {
  return useMutation<AISearchResponse, Error, AISearchInput>({
    mutationFn: ({ query, categoryIds }) => aiSearchSongs(query, categoryIds),
  })
}
