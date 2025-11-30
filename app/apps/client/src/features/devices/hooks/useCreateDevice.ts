import { useMutation, useQueryClient } from '@tanstack/react-query'

import { DEVICES_QUERY_KEY } from './useDevices'
import { createDevice } from '../service'
import type { CreateDeviceInput } from '../types'

export function useCreateDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateDeviceInput) => createDevice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY })
    },
  })
}
