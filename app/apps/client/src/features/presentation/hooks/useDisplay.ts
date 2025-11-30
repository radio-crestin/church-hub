import { useQuery } from '@tanstack/react-query'

import { getDisplayById } from '../service/displays'

export function useDisplay(id: number) {
  return useQuery({
    queryKey: ['displays', id],
    queryFn: () => getDisplayById(id),
    enabled: id > 0,
  })
}
