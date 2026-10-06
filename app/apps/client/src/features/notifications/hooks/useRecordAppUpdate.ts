import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useAppUpdate } from '~/features/app-update/hooks/useAppUpdate'
import { isTauri } from '~/utils/isTauri'
import {
  NOTIFICATIONS_QUERY_KEY,
  recordAppUpdate,
} from '../service/notificationsApi'

/**
 * Checks for a new app version (at start, then periodically) and puts each
 * new one in the notifications. Only the desktop app can install one.
 */
export function useRecordAppUpdate(): void {
  const queryClient = useQueryClient()
  const { updateInfo } = useAppUpdate()
  const version = updateInfo?.hasUpdate ? updateInfo.latestVersion : null

  useEffect(() => {
    if (!version || !isTauri()) return
    void recordAppUpdate(version).then(() =>
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    )
  }, [version, queryClient])
}
