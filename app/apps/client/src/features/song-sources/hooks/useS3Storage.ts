import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getS3Storage, saveS3Storage } from '../service/songSourcesSettingsApi'

const STORAGE_KEY = ['song-sources', 'storage'] as const

export function useS3Storage() {
  return useQuery({ queryKey: STORAGE_KEY, queryFn: getS3Storage })
}

export function useSaveS3Storage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveS3Storage,
    onSuccess: (storage) => {
      queryClient.setQueryData(STORAGE_KEY, storage)
      // Share links are built from the storage's public URL.
      queryClient.invalidateQueries({
        queryKey: ['song-sources', 'publications'],
      })
    },
  })
}
