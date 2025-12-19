import { useMutation, useQueryClient } from '@tanstack/react-query'

import { screenQueryKey } from './useScreen'
import { screensQueryKey } from './useScreens'
import { upsertScreen } from '../service/screens'

export function useUpsertScreen() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertScreen,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: screensQueryKey })
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: screenQueryKey(data.id) })
      }
    },
  })
}
