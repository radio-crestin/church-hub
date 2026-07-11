import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useYouTubeAuth } from '~/features/livestream/hooks/useYouTubeAuth'
import {
  type BackupActionResult,
  type BackupFile,
  type BackupStatus,
  backupNow,
  getBackupStatus,
  listBackups,
  restoreBackup,
  updateBackupConfig,
} from '../service'

/**
 * Backup feature state. Reuses the single Google connection managed by the
 * livestream feature (`useYouTubeAuth`) for connecting/reconnecting/disconnecting,
 * and layers the Drive-backup status, list and actions on top.
 */
export function useBackup() {
  const queryClient = useQueryClient()
  const google = useYouTubeAuth()

  const statusQuery = useQuery({
    queryKey: ['backup', 'status'],
    queryFn: getBackupStatus,
    staleTime: 60 * 1000,
  })

  const driveReady = statusQuery.data?.driveReady ?? false

  const listQuery = useQuery({
    queryKey: ['backup', 'list'],
    queryFn: listBackups,
    enabled: driveReady,
    staleTime: 30 * 1000,
  })

  // When the Google connection changes (connect / reconnect / logout), the
  // Drive status may now differ — refresh backup status and list.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['backup'] })
  }, [google.isAuthenticated, queryClient])

  const backupNowMutation = useMutation<BackupActionResult>({
    mutationFn: backupNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup'] })
    },
  })

  const restoreMutation = useMutation<BackupActionResult, Error, string>({
    mutationFn: restoreBackup,
  })

  const updateConfigMutation = useMutation({
    mutationFn: updateBackupConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'status'] })
    },
  })

  const status: BackupStatus | undefined = statusQuery.data
  const backups: BackupFile[] = listQuery.data ?? []

  return {
    // status
    status,
    isLoadingStatus: statusQuery.isLoading,
    connected: status?.connected ?? false,
    driveReady,
    requiresReconnect: status?.requiresReconnect ?? false,
    autoBackupEnabled: status?.autoBackupEnabled ?? false,
    intervalHours: status?.intervalHours ?? 24,
    lastBackupAt: status?.lastBackupAt ?? null,
    // Google connection (shared with livestream)
    channelName: google.channelName,
    isAuthenticating: google.isAuthenticating,
    connect: google.login,
    disconnect: google.logout,
    isDisconnecting: google.isLoggingOut,
    // list
    backups,
    isLoadingBackups: listQuery.isLoading,
    backupsError: listQuery.error as
      | (Error & { requiresReconnect?: boolean })
      | null,
    // actions
    backupNow: backupNowMutation.mutateAsync,
    isBackingUp: backupNowMutation.isPending,
    restore: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    updateConfig: updateConfigMutation.mutateAsync,
    isUpdatingConfig: updateConfigMutation.isPending,
  }
}
