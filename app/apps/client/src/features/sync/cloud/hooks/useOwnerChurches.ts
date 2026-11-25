import { useQuery } from '@tanstack/react-query'

import { listOwnerChurches } from '../service'

export const ownerChurchesQueryKey = ['sync', 'owner', 'churches'] as const

/** The signed-in owner's church servers (only while signed in). */
export function useOwnerChurches(signedIn: boolean) {
  return useQuery({
    queryKey: ownerChurchesQueryKey,
    queryFn: listOwnerChurches,
    enabled: signedIn,
  })
}
