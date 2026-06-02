import { useQuery } from '@tanstack/react-query'

import { getLocalUsers } from '../service'

export const LOCAL_USERS_QUERY_KEY = ['local-users']

/**
 * Minimal public user list used by the login screen and to decide whether a
 * "switch user" control is meaningful (more than one user, or any password).
 */
export function useLocalUsers() {
  return useQuery({
    queryKey: LOCAL_USERS_QUERY_KEY,
    queryFn: getLocalUsers,
  })
}
