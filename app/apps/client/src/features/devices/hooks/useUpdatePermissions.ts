import { useMutation, useQueryClient } from '@tanstack/react-query'

import { DEVICES_QUERY_KEY } from './useDevices'
import { updateDevicePermissions } from '../service'
import type { DevicePermissions } from '../types'

export function useUpdatePermissions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      permissions,
    }: {
      id: number
      permissions: DevicePermissions
    }) => updateDevicePermissions(id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY })
    },
  })
}
