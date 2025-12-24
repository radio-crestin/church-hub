import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteHighlightColor,
  getAllHighlightColors,
  type HighlightColor,
  reorderHighlightColors,
  type UpsertHighlightColorInput,
  upsertHighlightColor,
} from '../service/highlight-colors'

export const highlightColorsQueryKey = ['highlight-colors']

/**
 * Hook to fetch all highlight colors
 */
export function useHighlightColors() {
  return useQuery({
    queryKey: highlightColorsQueryKey,
    queryFn: getAllHighlightColors,
  })
}

/**
 * Hook to create or update a highlight color
 */
export function useUpsertHighlightColor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertHighlightColorInput) =>
      upsertHighlightColor(input),
    onSuccess: () => {
      // Invalidate the query to refetch - WebSocket will also update but this ensures immediate refresh
      queryClient.invalidateQueries({ queryKey: highlightColorsQueryKey })
    },
  })
}

/**
 * Hook to delete a highlight color
 */
export function useDeleteHighlightColor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteHighlightColor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlightColorsQueryKey })
    },
  })
}

/**
 * Hook to reorder highlight colors
 */
export function useReorderHighlightColors() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (colorIds: number[]) => reorderHighlightColors({ colorIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: highlightColorsQueryKey })
    },
  })
}

export type { HighlightColor, UpsertHighlightColorInput }
