import { useMutation, useQueryClient } from '@tanstack/react-query'

import { unlinkSong } from '../service'

/**
 * Detaches a song from its group ("Not the same song"). Used by the
 * versions panel to remove a wrongly-grouped member.
 */
export function useUnlinkSong() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, number>({
    mutationFn: (songId) => unlinkSong(songId),
    onSuccess: (_void, songId) => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['song-group', songId] })
      queryClient.invalidateQueries({ queryKey: ['song-group'] })
    },
  })
}
