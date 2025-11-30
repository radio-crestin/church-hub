import { useMutation, useQueryClient } from '@tanstack/react-query'

import { DEVICES_QUERY_KEY } from './useDevices'
import { updateDevice } from '../service'
import type { UpdateDeviceInput } from '../types'

export function useUpdateDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateDeviceInput }) =>
      updateDevice(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY })
    },
  })
}
