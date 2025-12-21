import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getOBSScenes,
  reorderOBSScenes,
  switchOBSScene,
  updateOBSScene,
} from '../service'

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
      data: { displayName?: string; isVisible?: boolean; shortcuts?: string[] }
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
    onSuccess: () => {
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
