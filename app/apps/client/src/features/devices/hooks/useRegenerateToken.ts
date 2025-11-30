import { useMutation, useQueryClient } from '@tanstack/react-query'

import { DEVICES_QUERY_KEY } from './useDevices'
import { regenerateDeviceToken } from '../service'

export function useRegenerateToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => regenerateDeviceToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY })
    },
  })
}
