import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getLibraryShares,
  saveLibraryShare,
  stopLibraryShare,
  syncLibraryShare,
} from '../service/songSourcesSettingsApi'

const SHARES_KEY = ['song-sources', 'shares'] as const

export function useLibraryShares() {
  return useQuery({ queryKey: SHARES_KEY, queryFn: getLibraryShares })
}

/** A change to a share; the shares are read again after it, failed or not. */
function useShareMutation<T>(mutationFn: (arg: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: SHARES_KEY }),
  })
}

export const useSaveLibraryShare = () => useShareMutation(saveLibraryShare)
export const useSyncLibraryShare = () => useShareMutation(syncLibraryShare)
export const useStopLibraryShare = () => useShareMutation(stopLibraryShare)
