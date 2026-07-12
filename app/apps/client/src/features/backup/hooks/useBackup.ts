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
// After a backup, re-check the list on this cadence until a genuinely new
// backup id shows up (Drive's files.list can lag behind a just-created file).
const BACKUP_POLL_INTERVAL_MS = 15_000
// Give up polling after this long so the spinner can't spin forever.
const BACKUP_POLL_TIMEOUT_MS = 5 * 60_000

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
    prevIds: string[]
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
    // Always fetch fresh: the list changes out-of-band (new/auto/deleted
    // backups), so never serve a stale cached list.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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

    const { prevIds, targetId, added, since } = awaitingBackup
    const prevSet = new Set(prevIds)

    const poll = async () => {
      while (!cancelled) {
        // Fetch directly (same call the manual refresh uses). Drive's
        // files.list is eventually consistent, so a just-created backup can be
        // missing here for a few seconds after the upload already succeeded.
        let driveList: BackupFile[] = []
        let fetched = false
        try {
          driveList = await listBackups()
          fetched = true
        } catch {
          // Transient error (e.g. Drive hiccup) — keep polling.
        }

        // Whatever Drive returned, never drop the just-created backup from the
        // visible list while Drive catches up: keep it pinned on top until its
        // real entry shows up.
        if (fetched && !cancelled) {
          const merged =
            added && !driveList.some((f) => f.id === added.id)
              ? [added, ...driveList]
              : driveList
          queryClient.setQueryData<BackupFile[]>(['backup', 'list'], merged)
        }

        // Confirmed ONLY when Drive's own list returns the new backup — its
        // server-issued id, or (if the server sent no metadata) any id that
        // didn't exist before this backup. Confirming by the target id avoids
        // false positives from a stale prevIds snapshot.
        const confirmed = targetId
          ? driveList.some((f) => f.id === targetId)
          : fetched && driveList.some((f) => !prevSet.has(f.id))
        if (confirmed || Date.now() - since > BACKUP_POLL_TIMEOUT_MS) break

        await new Promise((resolve) =>
          setTimeout(resolve, BACKUP_POLL_INTERVAL_MS),
        )
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
    { prevIds: string[] }
  >({
    mutationFn: backupNow,
    // Snapshot the ids that exist BEFORE uploading, so we can detect when a
    // brand-new backup id appears in the list (reliable even without metadata).
    // Fetch fresh from Drive rather than trusting the cache, which may be empty
    // or stale at click time and would otherwise make a pre-existing file look
    // "new" and stop the poll on its very first tick.
    onMutate: async () => {
      let list = queryClient.getQueryData<BackupFile[]>(['backup', 'list'])
      if (!list) {
        try {
          list = await listBackups()
          queryClient.setQueryData<BackupFile[]>(['backup', 'list'], list)
        } catch {
          list = []
        }
      }
      return { prevIds: list.map((f) => f.id) }
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
        prevIds: context?.prevIds ?? [],
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
    backupsError:
      listQuery.error instanceof Error ? listQuery.error.message : null,
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
