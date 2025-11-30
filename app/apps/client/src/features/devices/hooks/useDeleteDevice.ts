import { useMutation, useQueryClient } from '@tanstack/react-query'

import { DEVICES_QUERY_KEY } from './useDevices'
import { deleteDevice } from '../service'

export function useDeleteDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY })
    },
  })
}
