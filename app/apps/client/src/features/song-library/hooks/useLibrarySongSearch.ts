import { useQuery } from '@tanstack/react-query'

import { searchLibrarySongs } from '../service/songLibrary'

/** Library songs whose title holds `query` (to merge a submission into). */
export function useLibrarySongSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['song-library', 'songs', query],
    queryFn: () => searchLibrarySongs(query),
    enabled,
  })
}
