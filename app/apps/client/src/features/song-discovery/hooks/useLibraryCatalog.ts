import { useQuery } from '@tanstack/react-query'

import { getLibraryCatalog } from '../service/songSourcesApi'

/** The public catalog of shared libraries, read once it is opened. */
export function useLibraryCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ['song-sources', 'catalog'],
    queryFn: getLibraryCatalog,
    enabled,
    staleTime: 60_000,
  })
}
