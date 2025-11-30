import { useQuery } from '@tanstack/react-query'

import { getAllPrograms } from '../service/programs'

export const PROGRAMS_QUERY_KEY = ['programs']

export function usePrograms() {
  return useQuery({
    queryKey: PROGRAMS_QUERY_KEY,
    queryFn: getAllPrograms,
  })
}
