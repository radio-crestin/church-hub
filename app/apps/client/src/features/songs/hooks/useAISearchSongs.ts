import { useMutation } from '@tanstack/react-query'

import { aiSearchSongs } from '../service'
import type { AISearchResponse } from '../types'

interface AISearchInput {
  query: string
  categoryId?: number
}

export function useAISearchSongs() {
  return useMutation<AISearchResponse, Error, AISearchInput>({
    mutationFn: ({ query, categoryId }) => aiSearchSongs(query, categoryId),
  })
}
