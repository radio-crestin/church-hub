import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { syncStatusQueryKey } from '~/features/sync'
import {
  addCloudDevice,
  connectCloud,
  listCloudDevices,
  revokeCloudDevice,
} from '../service/cloudDevicesApi'

export const CLOUD_DEVICES_KEY = ['sync', 'cloud', 'devices']

/** The church's devices on the cloud sync service, and adding or revoking one. */
export function useCloudDevices(enabled: boolean) {
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: CLOUD_DEVICES_KEY })
  const devices = useQuery({
    queryKey: CLOUD_DEVICES_KEY,
    queryFn: listCloudDevices,
    enabled,
  })
  const add = useMutation({ mutationFn: addCloudDevice, onSuccess: refresh })
  const revoke = useMutation({
    mutationFn: revokeCloudDevice,
    onSuccess: refresh,
  })
  return { devices, add, revoke }
}

/** Connects this computer to the cloud sync service. */
export function useConnectCloud() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: connectCloud,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: syncStatusQueryKey }),
  })
}
