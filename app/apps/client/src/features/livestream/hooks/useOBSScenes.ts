import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ContentType } from '../constants/content-types'
import {
  getOBSScenes,
  reorderOBSScenes,
  switchOBSScene,
  updateOBSScene,
} from '../service'
import type { OBSScene } from '../types'

export function useOBSScenes(visibleOnly = false) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'obs', 'scenes', visibleOnly],
    queryFn: () => getOBSScenes(visibleOnly),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: {
        displayName?: string
        isVisible?: boolean
        shortcuts?: string[]
        contentTypes?: ContentType[]
      }
    }) => updateOBSScene(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'obs', 'scenes'],
      })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (sceneIds: number[]) => reorderOBSScenes(sceneIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'obs', 'scenes'],
      })
    },
  })

  const switchMutation = useMutation({
    mutationFn: (sceneName: string) => switchOBSScene(sceneName),
    onMutate: async (sceneName) => {
      // Cancel any outgoing refetches to prevent overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: ['livestream', 'obs', 'scenes'],
      })

      // Snapshot current state for potential rollback
      const previousScenes = queryClient.getQueryData([
        'livestream',
        'obs',
        'scenes',
        visibleOnly,
      ])

      // Optimistically update: set the clicked scene as current
      queryClient.setQueryData(
        ['livestream', 'obs', 'scenes', visibleOnly],
        (old: OBSScene[] | undefined) => {
          if (!old) return old
          return old.map((scene) => ({
            ...scene,
            isCurrent: scene.obsSceneName === sceneName,
          }))
        },
      )

      return { previousScenes }
    },
    onError: (_err, _sceneName, context) => {
      // Rollback to previous state on error
      if (context?.previousScenes) {
        queryClient.setQueryData(
          ['livestream', 'obs', 'scenes', visibleOnly],
          context.previousScenes,
        )
      }
    },
    onSettled: () => {
      // Always refetch after mutation to sync with server
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'obs', 'scenes'],
      })
    },
  })

  const currentScene = query.data?.find((scene) => scene.isCurrent)

  return {
    ...query,
    scenes: query.data ?? [],
    currentScene,
    updateScene: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    reorderScenes: reorderMutation.mutate,
    isReordering: reorderMutation.isPending,
    switchScene: switchMutation.mutate,
    switchSceneAsync: switchMutation.mutateAsync,
    isSwitching: switchMutation.isPending,
  }
}
