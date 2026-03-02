import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  deleteAllSceneOverrides,
  deleteSceneOverride,
  upsertSceneOverride,
} from '../service/screens'
import type { ContentType } from '../types'

export function useUpsertSceneOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      screenId,
      obsSceneName,
      contentType,
      config,
    }: {
      screenId: number
      obsSceneName: string
      contentType: ContentType
      config: Record<string, unknown>
    }) => upsertSceneOverride(screenId, obsSceneName, contentType, config),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['screens', variables.screenId],
      })
    },
  })
}

export function useDeleteSceneOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      screenId,
      obsSceneName,
      contentType,
    }: {
      screenId: number
      obsSceneName: string
      contentType: ContentType
    }) => deleteSceneOverride(screenId, obsSceneName, contentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['screens', variables.screenId],
      })
    },
  })
}

export function useDeleteAllSceneOverrides() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (screenId: number) => deleteAllSceneOverrides(screenId),
    onSuccess: (_data, screenId) => {
      queryClient.invalidateQueries({
        queryKey: ['screens', screenId],
      })
    },
  })
}
