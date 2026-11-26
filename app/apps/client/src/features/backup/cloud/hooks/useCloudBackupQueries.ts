import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getCloudBackupStatus, listCloudBackups } from '../service/cloudBackup'

export const cloudBackupQueryKey = ['backup', 'cloud'] as const

export function useCloudBackupStatus() {
  return useQuery({
    queryKey: [...cloudBackupQueryKey, 'status'],
    queryFn: getCloudBackupStatus,
  })
}

/** The account's cloud backups, fetched only while signed in. */
export function useCloudBackups(signedIn: boolean) {
  return useQuery({
    queryKey: [...cloudBackupQueryKey, 'backups'],
    queryFn: listCloudBackups,
    enabled: signedIn,
    staleTime: 30_000,
  })
}

/** A cloud backup action: refreshes the status and the list once done. */
export function useCloudBackupAction<TInput, TResult>(
  action: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: action,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: cloudBackupQueryKey }),
  })
}
