import { useQuery } from '@tanstack/react-query'

import { getAllSongs } from '../service'
import type { Song } from '../types'

export function useSongs() {
  return useQuery<Song[]>({
    queryKey: ['songs'],
    queryFn: getAllSongs,
  })
}
