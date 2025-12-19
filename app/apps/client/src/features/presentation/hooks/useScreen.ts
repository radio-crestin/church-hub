import { useQuery } from '@tanstack/react-query'

import { getScreenById } from '../service/screens'

export function screenQueryKey(id: number) {
  return ['screens', id]
}

export function useScreen(id: number | null) {
  return useQuery({
    queryKey: screenQueryKey(id ?? 0),
    queryFn: () => getScreenById(id!),
    enabled: id !== null,
  })
}
