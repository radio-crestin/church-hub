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
  // Set right after a backup; drives auto-polling of the list until the new
  // backup shows up (Drive's files.list can lag a few seconds behind).
  const [awaitingBackup, setAwaitingBackup] = useState<{
    prevMax: number
    targetId?: string
    added?: BackupFile
    since: number
  } | null>(null)

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

  // After a backup, actively refetch the list until the new backup shows up
  // (Drive's files.list can lag a few seconds behind a just-created file).
  useEffect(() => {
    if (!awaitingBackup) return
    let cancelled = false

    const { prevMax, targetId, added, since } = awaitingBackup

    const poll = async () => {
      while (!cancelled) {
        await queryClient.refetchQueries({ queryKey: ['backup', 'list'] })
        const driveList =
          queryClient.getQueryData<BackupFile[]>(['backup', 'list']) ?? []
        // "Found" is based on what Drive actually returns (not our optimistic
        // entry), so we stop only once Drive has really indexed the new file.
        const foundInDrive = targetId
          ? driveList.some((f) => f.id === targetId)
          : driveList.some((f) => f.createdAtMs > prevMax)
        if (foundInDrive || Date.now() - since > 90_000) break
        // Keep the just-created backup visible while Drive catches up.
        if (added && !driveList.some((f) => f.id === added.id)) {
          queryClient.setQueryData<BackupFile[]>(
            ['backup', 'list'],
            [added, ...driveList],
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 2500))
      }
      if (!cancelled) setAwaitingBackup(null)
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [awaitingBackup, queryClient])

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

  const backupNowMutation = useMutation<
    BackupActionResult,
    Error,
    void,
    { prevMax: number }
  >({
    mutationFn: backupNow,
    // Snapshot the newest backup's timestamp BEFORE uploading, so we can detect
    // when a strictly-newer one appears in the list.
    onMutate: () => {
      const list =
        queryClient.getQueryData<BackupFile[]>(['backup', 'list']) ?? []
      const prevMax = list.reduce((m, f) => Math.max(m, f.createdAtMs), 0)
      return { prevMax }
    },
    onSuccess: (result, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'status'] })

      // Show it instantly if the server returned metadata...
      const added = result.backup
      if (added) {
        queryClient.setQueryData<BackupFile[]>(['backup', 'list'], (old) => {
          const list = old ?? []
          return list.some((f) => f.id === added.id) ? list : [added, ...list]
        })
      }

      // ...and keep auto-refreshing the list until Drive really has the backup.
      setAwaitingBackup({
        prevMax: context?.prevMax ?? 0,
        targetId: added?.id,
        added,
        since: Date.now(),
      })
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
    isAwaitingBackup: awaitingBackup !== null,
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
