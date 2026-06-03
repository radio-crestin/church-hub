import { useMutation, useQueryClient } from '@tanstack/react-query'

import { setPrimarySong } from '../service'
import type { SongGroup } from '../types'

interface SetPrimaryInput {
  groupId: number
  songId: number
}

/**
 * Marks one member of a group as its primary (canonical) version.
 */
export function useSetPrimarySong() {
  const queryClient = useQueryClient()

  return useMutation<SongGroup, Error, SetPrimaryInput>({
    mutationFn: ({ groupId, songId }) => setPrimarySong(groupId, songId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['song-group'] })
      queryClient.invalidateQueries({ queryKey: ['songs'] })
    },
  })
}
