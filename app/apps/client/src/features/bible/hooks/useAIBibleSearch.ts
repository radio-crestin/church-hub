import { useMutation } from '@tanstack/react-query'

import { aiBibleSearch } from '../service/bible'
import type { AIBibleSearchResponse } from '../types'

interface AIBibleSearchInput {
  query: string
  translationId?: number
}

/**
 * Mutation hook for AI-enhanced Bible search
 */
export function useAIBibleSearch() {
  return useMutation<AIBibleSearchResponse, Error, AIBibleSearchInput>({
    mutationFn: ({ query, translationId }) =>
      aiBibleSearch(query, translationId),
  })
}
