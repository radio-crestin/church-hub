import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { openAuthUrl } from '~/features/livestream/utils'
import {
  type BackupActionResult,
  type BackupFile,
  backupNow,
  connectGoogleDrive,
  deleteBackup,
  disconnectGoogleDrive,
  getBackupStatus,
  listBackups,
  restoreBackup,
  updateBackupConfig,
} from '../service'

const AUTH_TIMEOUT_MS = 120_000

/**
 * Backup feature state. The Google Drive connection is fully independent from
 * the livestream YouTube connection: connect opens its own OAuth flow (loopback)
 * and we poll the status until the browser completes it.
 */
export function useBackup() {
  const queryClient = useQueryClient()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['backup', 'status'],
    queryFn: getBackupStatus,
    staleTime: 60 * 1000,
    // While the browser completes OAuth, poll so the UI updates on its own.
    refetchInterval: isAuthenticating ? 2500 : false,
  })

  const status = statusQuery.data
  const driveReady = status?.driveReady ?? false

  const listQuery = useQuery({
    queryKey: ['backup', 'list'],
    queryFn: listBackups,
    enabled: driveReady,
    staleTime: 30 * 1000,
  })

  // Stop the polling spinner once the connection lands.
  useEffect(() => {
    if (isAuthenticating && status?.connected) {
      setIsAuthenticating(false)
    }
  }, [isAuthenticating, status?.connected])

  const connect = useCallback(async () => {
    setConnectError(null)
    const result = await connectGoogleDrive()
    if (result.error || !result.authUrl) {
      setConnectError(result.error || 'connect_failed')
      return
    }
    setIsAuthenticating(true)
    try {
      await openAuthUrl(result.authUrl, { popupName: 'google-drive-auth' })
    } catch {
      setConnectError('open_browser_failed')
      setIsAuthenticating(false)
      return
    }
    // Safety net: stop the spinner even if the user abandons the browser flow.
    setTimeout(() => setIsAuthenticating(false), AUTH_TIMEOUT_MS)
  }, [])

  const disconnectMutation = useMutation({
    mutationFn: disconnectGoogleDrive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup'] })
    },
  })

  const backupNowMutation = useMutation<BackupActionResult>({
    mutationFn: backupNow,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'status'] })

      const added = result.backup
      if (!added) {
        // No metadata (older server) — refetch a few times to outlast Drive lag.
        let tries = 0
        const retry = async () => {
          tries += 1
          await queryClient.invalidateQueries({ queryKey: ['backup', 'list'] })
          if (tries < 4) setTimeout(retry, 3000)
        }
        void retry()
        return
      }

      // Drive's files.list can lag several seconds behind a just-created file.
      // Insert it optimistically so it shows immediately, and keep re-applying
      // it after each reconcile until Drive returns it on its own.
      const upsert = (old?: BackupFile[]): BackupFile[] => {
        const list = old ?? []
        return list.some((f) => f.id === added.id) ? list : [added, ...list]
      }
      queryClient.setQueryData<BackupFile[]>(['backup', 'list'], upsert)

      let attempts = 0
      const reconcile = async () => {
        attempts += 1
        await queryClient.invalidateQueries({ queryKey: ['backup', 'list'] })
        const list =
          queryClient.getQueryData<BackupFile[]>(['backup', 'list']) ?? []
        const present = list.some((f) => f.id === added.id)
        if (!present) {
          // Drive still hasn't caught up — keep the optimistic entry and retry.
          queryClient.setQueryData<BackupFile[]>(['backup', 'list'], upsert)
          if (attempts < 5) setTimeout(reconcile, 3000)
        }
      }
      setTimeout(reconcile, 3000)
    },
  })

  const restoreMutation = useMutation<BackupActionResult, Error, string>({
    mutationFn: restoreBackup,
  })

  const deleteMutation = useMutation<BackupActionResult, Error, string>({
    mutationFn: deleteBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'list'] })
    },
  })

  const updateConfigMutation = useMutation({
    mutationFn: updateBackupConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'status'] })
    },
  })

  return {
    // status
    status,
    isLoadingStatus: statusQuery.isLoading,
    configured: status?.configured ?? true,
    connected: status?.connected ?? false,
    driveReady,
    requiresReconnect: status?.requiresReconnect ?? false,
    email: status?.email ?? null,
    autoBackupEnabled: status?.autoBackupEnabled ?? false,
    intervalHours: status?.intervalHours ?? 24,
    lastBackupAt: status?.lastBackupAt ?? null,
    // connection
    connect,
    connectError,
    isAuthenticating,
    /** Fetches a fresh authorization URL (for the "copy link" affordance). */
    getConnectUrl: connectGoogleDrive,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    // list
    backups: listQuery.data ?? [],
    isLoadingBackups: listQuery.isLoading,
    isFetchingBackups: listQuery.isFetching,
    refetchBackups: listQuery.refetch,
    // actions
    backupNow: backupNowMutation.mutateAsync,
    isBackingUp: backupNowMutation.isPending,
    restore: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    deleteBackup: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    updateConfig: updateConfigMutation.mutateAsync,
    isUpdatingConfig: updateConfigMutation.isPending,
  }
}
