import { useQuery } from '@tanstack/react-query'

import { listLibrarySubmissions } from '../service/songLibrary'

export const librarySubmissionsQueryKey = [
  'song-library',
  'submissions',
] as const

/** The curator's queue, once a curator is signed in. */
export function useLibrarySubmissions(enabled: boolean) {
  return useQuery({
    queryKey: librarySubmissionsQueryKey,
    queryFn: listLibrarySubmissions,
    enabled,
  })
}
