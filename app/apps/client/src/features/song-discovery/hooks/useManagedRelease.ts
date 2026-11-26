import { useQuery } from '@tanstack/react-query'

import type { ManagedRelease, SongSource } from '../providers'
import { getManagedRelease } from '../service/songSourcesApi'

/** The version of a managed source's hosted copy (null while there is none). */
export function useManagedRelease(source: SongSource) {
  return useQuery<ManagedRelease | null>({
    queryKey: ['song-sources', source.id, 'managed'],
    queryFn: () => getManagedRelease(source.id),
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(source.managed),
  })
}
