import { useMutation, useQueryClient } from '@tanstack/react-query'

import { linkSongs } from '../service'
import type { SongGroup } from '../types'

interface LinkInput {
  songIdA: number
  songIdB: number
}

/**
 * Links two songs as versions of the same piece. Invalidates the songs
 * list (badge count), both songs' group queries, and the version
 * suggestions (so a just-linked song drops out of "Posibile potriviri" —
 * the server excludes group members from suggestions).
 */
export function useLinkSongs() {
  const queryClient = useQueryClient()

  return useMutation<SongGroup, Error, LinkInput>({
    mutationFn: ({ songIdA, songIdB }) => linkSongs(songIdA, songIdB),
    onSuccess: (_group, { songIdA, songIdB }) => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['song-group', songIdA] })
      queryClient.invalidateQueries({ queryKey: ['song-group', songIdB] })
      queryClient.invalidateQueries({ queryKey: ['song-similar'] })
    },
  })
}
