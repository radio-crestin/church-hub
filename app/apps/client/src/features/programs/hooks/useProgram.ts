import { useQuery } from '@tanstack/react-query'

import { getProgramById } from '../service/programs'

export function useProgramQueryKey(id: number) {
  return ['programs', id]
}

export function useProgram(id: number) {
  return useQuery({
    queryKey: useProgramQueryKey(id),
    queryFn: () => getProgramById(id),
    enabled: id > 0,
  })
}
