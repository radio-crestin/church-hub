import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getPublications,
  publishCategory,
  syncPublication,
  unpublish,
} from '../service/songSourcesSettingsApi'
import type { Publication } from '../types'

const PUBLICATIONS_KEY = ['song-sources', 'publications'] as const

export function usePublications() {
  return useQuery({ queryKey: PUBLICATIONS_KEY, queryFn: getPublications })
}

/** A publication change; each answers with the full, current list. */
function usePublicationMutation<T>(
  mutationFn: (arg: T) => Promise<Publication[]>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (list) => queryClient.setQueryData(PUBLICATIONS_KEY, list),
    // A failed upload is recorded on the publication; show it.
    onError: () =>
      queryClient.invalidateQueries({ queryKey: PUBLICATIONS_KEY }),
  })
}

export const usePublishCategory = () => usePublicationMutation(publishCategory)
export const useSyncPublication = () => usePublicationMutation(syncPublication)
export const useUnpublish = () => usePublicationMutation(unpublish)
