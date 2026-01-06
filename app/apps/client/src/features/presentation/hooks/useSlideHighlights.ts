import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addSlideHighlight,
  clearSlideHighlights,
  getSlideHighlights,
  removeSlideHighlight,
} from '../service/highlights'
import type { AddHighlightInput, TextStyleRange } from '../types'

export const slideHighlightsQueryKey = ['presentation', 'highlights']

/**
 * Hook to fetch current slide highlights
 */
export function useSlideHighlights() {
  return useQuery({
    queryKey: slideHighlightsQueryKey,
    queryFn: getSlideHighlights,
    // WebSocket handles real-time updates, use longer polling as fallback
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook to add a highlight to the current slide
 */
export function useAddSlideHighlight() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddHighlightInput) => {
      // Generate UUID on client side using native crypto API
      const highlight: TextStyleRange = {
        id: crypto.randomUUID(),
        ...input,
      }
      return addSlideHighlight(highlight)
    },
    onSuccess: (data) => {
      // Update cache with new highlights
      queryClient.setQueryData(slideHighlightsQueryKey, data)
    },
  })
}

/**
 * Hook to remove a specific highlight
 */
export function useRemoveSlideHighlight() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (highlightId: string) => removeSlideHighlight(highlightId),
    onSuccess: (data) => {
      // Update cache with remaining highlights
      queryClient.setQueryData(slideHighlightsQueryKey, data)
    },
  })
}

/**
 * Hook to clear all highlights
 */
export function useClearSlideHighlights() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => clearSlideHighlights(),
    onSuccess: () => {
      // Clear the cache
      queryClient.setQueryData(slideHighlightsQueryKey, [])
    },
  })
}
