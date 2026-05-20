import { useQuery } from '@tanstack/react-query'

import { getAllTags } from '../service'
import type { SongTag } from '../types'

export function useTags() {
  return useQuery<SongTag[]>({
    queryKey: ['song-tags'],
    queryFn: getAllTags,
  })
}
