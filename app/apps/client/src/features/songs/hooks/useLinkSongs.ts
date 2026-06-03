import { useMutation, useQueryClient } from '@tanstack/react-query'

import { linkSongs } from '../service'
import type { SongGroup } from '../types'

interface LinkInput {
  songIdA: number
  songIdB: number
}

/**
 * Links two songs as versions of the same piece. Invalidates the songs
 * list (badge count) and both songs' group queries.
 */
export function useLinkSongs() {
  const queryClient = useQueryClient()

  return useMutation<SongGroup, Error, LinkInput>({
    mutationFn: ({ songIdA, songIdB }) => linkSongs(songIdA, songIdB),
    onSuccess: (_group, { songIdA, songIdB }) => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['song-group', songIdA] })
      queryClient.invalidateQueries({ queryKey: ['song-group', songIdB] })
    },
  })
}
