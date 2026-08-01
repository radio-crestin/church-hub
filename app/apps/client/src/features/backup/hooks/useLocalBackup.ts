import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type BackupActionResult,
  deleteLocalBackup,
  type LocalBackupFile,
  listLocalBackups,
  localBackupNow,
  updateBackupConfig,
} from '../service'

const LOCAL_LIST_KEY = ['backup', 'local', 'list']

/**
 * Local (on-disk) backups: the configured folder's contents plus the actions
 * that write to and prune it.
 *
 * Kept separate from `useBackup` because this half works with no Google account
 * connected — the backups page renders it above the Drive connection card so an
 * operator who never signs in still gets a usable backup story.
 */
export function useLocalBackup(enabled: boolean) {
  const queryClient = useQueryClient()

  const listQuery = useQuery<LocalBackupFile[]>({
    queryKey: LOCAL_LIST_KEY,
    queryFn: listLocalBackups,
    enabled,
    staleTime: 30_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: LOCAL_LIST_KEY })
    // The chosen folder and the last local backup time both live on the status
    // payload, so the summary line stays truthful after every action.
    queryClient.invalidateQueries({ queryKey: ['backup', 'status'] })
  }

  const backupNowMutation = useMutation<
    BackupActionResult & { path?: string },
    Error,
    void
  >({
    mutationFn: localBackupNow,
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation<BackupActionResult, Error, string>({
    mutationFn: deleteLocalBackup,
    onSuccess: invalidate,
  })

  const setPathMutation = useMutation<unknown, Error, string | null>({
    mutationFn: (localBackupPath) => updateBackupConfig({ localBackupPath }),
    onSuccess: invalidate,
  })

  return {
    backups: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error instanceof Error ? listQuery.error.message : null,
    refetch: listQuery.refetch,
    backupNow: backupNowMutation.mutateAsync,
    isBackingUp: backupNowMutation.isPending,
    deleteBackup: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    setPath: setPathMutation.mutateAsync,
    isSettingPath: setPathMutation.isPending,
  }
}
