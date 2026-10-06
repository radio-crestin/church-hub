import { useMutation, useQueryClient } from '@tanstack/react-query'

import { SONG_SOURCES_QUERY_KEY } from '~/features/song-discovery/hooks/useSongSources'
import { SONG_UPDATES_QUERY_KEY } from '~/features/song-discovery/hooks/useSongUpdates'
import {
  addLinkSource,
  deleteLinkSource,
} from '~/features/song-discovery/service/songSourcesApi'
import { runSongUpdates } from '~/features/song-discovery/service/songUpdatesApi'

/** Adds a source from a link, and checks it for songs at once. */
export function useAddLinkSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addLinkSource,
    onSuccess: async (source) => {
      queryClient.invalidateQueries({ queryKey: SONG_SOURCES_QUERY_KEY })
      queryClient.setQueryData(
        SONG_UPDATES_QUERY_KEY,
        await runSongUpdates({ sourceIds: [source.id] }),
      )
    },
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
