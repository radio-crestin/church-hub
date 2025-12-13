import { useQuery } from '@tanstack/react-query'

import { getAllUsers } from '../service'

export const USERS_QUERY_KEY = ['users']

export function useUsers() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: getAllUsers,
  })
}
