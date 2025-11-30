import { useMutation, useQueryClient } from '@tanstack/react-query'

import { displaysQueryKey } from './useDisplays'
import { upsertDisplay } from '../service/displays'

export function useUpsertDisplay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertDisplay,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: displaysQueryKey })
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['displays', data.id] })
      }
    },
  })
}
