import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addSlideHighlight,
  clearSlideHighlights,
  getSlideHighlights,
  removeSlideHighlight,
  setSlideHighlights,
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
    // Consider data fresh for 5 seconds to reduce unnecessary refetches
    staleTime: 5000,
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

/**
 * Hook to replace every highlight on the current slide at once, used when a
 * bookmark's saved styling is poured back onto the screen.
 */
export function useSetSlideHighlights() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ranges: TextStyleRange[]) => setSlideHighlights(ranges),
    onSuccess: (data) => {
      queryClient.setQueryData(slideHighlightsQueryKey, data)
    },
  })
}
