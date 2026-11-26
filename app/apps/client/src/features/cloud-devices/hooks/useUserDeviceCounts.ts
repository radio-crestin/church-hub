import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { useSyncStatus } from '~/features/sync'
import { usePermissions } from '~/provider/permissions-provider'
import { CLOUD_DEVICES_KEY } from './useCloudDevices'
import { listCloudDevices } from '../service/cloudDevicesApi'

/**
 * How many cloud sync devices each user has joined that are still signed
 * in (none when this computer isn't on the cloud), and a refresh for after
 * a user change signed some out.
 */
export function useUserDeviceCounts() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const { data: status } = useSyncStatus()
  const connected = status?.transport === 'cloud' && status.cloud !== null
  const { data: devices } = useQuery({
    queryKey: CLOUD_DEVICES_KEY,
    queryFn: listCloudDevices,
    enabled: connected && hasPermission('users.edit'),
  })

  const counts = useMemo(() => {
    const byUser = new Map<number, number>()
    for (const device of devices ?? []) {
      if (device.isServer || device.revokedAt !== null) continue
      if (device.userId === null) continue
      byUser.set(device.userId, (byUser.get(device.userId) ?? 0) + 1)
    }
    return byUser
  }, [devices])

  const countFor = useCallback(
    (userId: number) => counts.get(userId) ?? 0,
    [counts],
  )
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: CLOUD_DEVICES_KEY }),
    [queryClient],
  )
  return { countFor, refresh }
}
