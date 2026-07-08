import { useMutation, useQueryClient } from '@tanstack/react-query'

import { presentedSongsQueryKey } from './usePresentedSongs'
import { SONG_BOOKMARKS_QUERY_KEY } from '../../songs/hooks/useSongBookmarks'
import { upsertSong } from '../../songs/service'

interface UpdateKeyLineInput {
  songId: number
  songTitle: string
  keyLine: string
}

export function useUpdateSongKeyLine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ songId, songTitle, keyLine }: UpdateKeyLineInput) => {
      const result = await upsertSong({
        id: songId,
        title: songTitle,
        keyLine: keyLine || null,
      })
      return result
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: presentedSongsQueryKey })
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        // The bookmarks list caches each song's keyLine, so refresh it too —
        // otherwise a bookmarked song keeps showing its old key.
        queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
        if (result.data) {
          queryClient.invalidateQueries({ queryKey: ['song', result.data.id] })
        }
      }
    },
  })
}
