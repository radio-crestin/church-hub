import { useQuery } from '@tanstack/react-query'

import { getAllDisplays } from '../service/displays'

export const displaysQueryKey = ['displays']

export function useDisplays() {
  return useQuery({
    queryKey: displaysQueryKey,
    queryFn: getAllDisplays,
  })
}
