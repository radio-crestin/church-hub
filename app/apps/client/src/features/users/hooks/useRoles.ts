import { useQuery } from '@tanstack/react-query'

import { getAllRoles } from '../service'

export const ROLES_QUERY_KEY = ['roles']

export function useRoles() {
  return useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: getAllRoles,
  })
}
