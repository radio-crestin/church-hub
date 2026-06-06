import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertCategory } from '../service'
import type { SongCategory, UpsertCategoryInput } from '../types'

export function useUpsertCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertCategoryInput) => upsertCategory(input),
    // Optimistically patch an existing category in the cache so the UI (e.g.
    // the hide/show eye) updates INSTANTLY instead of waiting for the round
    // trip. New categories (no id) have nothing to patch yet.
    onMutate: async (input) => {
      if (!input.id) return
      await queryClient.cancelQueries({ queryKey: ['categories'] })
      const previous = queryClient.getQueryData<SongCategory[]>(['categories'])
      queryClient.setQueryData<SongCategory[]>(['categories'], (old) =>
        old?.map((c) =>
          c.id === input.id
            ? {
                ...c,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.priority !== undefined
                  ? { priority: input.priority }
                  : {}),
                ...(input.isHidden !== undefined
                  ? { isHidden: input.isHidden }
                  : {}),
              }
            : c,
        ),
      )
      return { previous }
    },
    onError: (_err, _input, context) => {
      // Roll back the optimistic patch if the request failed.
      if (context?.previous) {
        queryClient.setQueryData(['categories'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      // Hiding/showing a category changes which songs are listed, so the song
      // browser must refetch too.
      queryClient.invalidateQueries({ queryKey: ['songs'] })
    },
  })
}
