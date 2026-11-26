import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getLibraryShare,
  saveLibraryShare,
  stopLibraryShare,
  syncLibraryShare,
} from '../service/songSourcesSettingsApi'

const SHARE_KEY = ['song-sources', 'share'] as const

export function useLibraryShare() {
  return useQuery({ queryKey: SHARE_KEY, queryFn: getLibraryShare })
}

/** A change to the share; the share is read again after it, failed or not. */
function useShareMutation<T>(mutationFn: (arg: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: SHARE_KEY }),
  })
}

export const useSaveLibraryShare = () => useShareMutation(saveLibraryShare)
export const useSyncLibraryShare = () =>
  useShareMutation((_: void) => syncLibraryShare())
export const useStopLibraryShare = () =>
  useShareMutation((_: void) => stopLibraryShare())
