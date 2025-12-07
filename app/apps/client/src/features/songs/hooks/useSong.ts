import { useQuery } from '@tanstack/react-query'

import { getSongById } from '../service'
import type { SongWithSlides } from '../types'

export function useSong(id: number | null) {
  return useQuery<SongWithSlides | null>({
    queryKey: ['song', id],
    queryFn: () => getSongById(id!),
    enabled: id !== null,
  })
}
