import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { addFolder, getFolders, removeFolder, syncFolder } from '../service'
import type { MusicFolder, SyncResult } from '../types'

export function useMusicFolders() {
  return useQuery<MusicFolder[]>({
    queryKey: ['music', 'folders'],
    queryFn: getFolders,
  })
}

export function useAddFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ path, name }: { path: string; name?: string }) =>
      addFolder(path, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music', 'folders'] })
    },
  })
}

export function useRemoveFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => removeFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music', 'folders'] })
      queryClient.invalidateQueries({ queryKey: ['music', 'files'] })
    },
  })
}

export function useSyncFolder() {
  const queryClient = useQueryClient()

  return useMutation<SyncResult | null, Error, number>({
    mutationFn: (id: number) => syncFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music', 'folders'] })
      queryClient.invalidateQueries({ queryKey: ['music', 'files'] })
    },
  })
}
