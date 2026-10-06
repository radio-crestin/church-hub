import { useMutation, useQueryClient } from '@tanstack/react-query'

import { SONG_SOURCES_QUERY_KEY } from '~/features/song-discovery/hooks/useSongSources'
import {
  addLinkSource,
  deleteLinkSource,
} from '~/features/song-discovery/service/songSourcesApi'

export function useAddLinkSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addLinkSource,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SONG_SOURCES_QUERY_KEY }),
  })
}

export function useDeleteLinkSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteLinkSource,
    onSuccess: (sources) =>
      queryClient.setQueryData(SONG_SOURCES_QUERY_KEY, sources),
  })
}
