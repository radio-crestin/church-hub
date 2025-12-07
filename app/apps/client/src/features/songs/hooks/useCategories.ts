import { useQuery } from '@tanstack/react-query'

import { getAllCategories } from '../service'
import type { SongCategory } from '../types'

export function useCategories() {
  return useQuery<SongCategory[]>({
    queryKey: ['categories'],
    queryFn: getAllCategories,
  })
}
