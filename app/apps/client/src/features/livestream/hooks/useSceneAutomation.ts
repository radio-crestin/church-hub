import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSceneAutomation, updateSceneAutomation } from '../service/obs'

export function useSceneAutomation() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'obs', 'scene-automation'],
    queryFn: getSceneAutomation,
    staleTime: 30 * 1000,
  })

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateSceneAutomation(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'obs', 'scene-automation'],
      })
    },
  })

  return {
    ...query,
    automationState: query.data,
    toggleAutomation: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  }
}
