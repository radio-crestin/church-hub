import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { ImportProgress } from '~/features/song-import'
import { fetchSourceCatalog, type SongSource } from '../providers'
import type { DiscoveryCandidate } from '../types'

/** React Query key of a source's parsed catalog. */
export function catalogQueryKey(sourceId: string | undefined) {
  return ['discovery-catalog', sourceId] as const
}

/**
 * Downloads + parses a song source's catalog, cached in React Query for an
 * hour so revisiting the screen (or re-running the diff) doesn't re-download
 * the multi-MB archive. `progress` tracks the in-flight download/parse phases;
 * `refetch` forces a fresh pull ("Refresh catalog").
 */
export function useFetchCatalog(source: SongSource | undefined) {
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  const query = useQuery<DiscoveryCandidate[]>({
    queryKey: catalogQueryKey(source?.id),
    enabled: source != null,
    staleTime: 1000 * 60 * 60, // 1h — external catalogs change rarely
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: async () => {
      if (!source) throw new Error('No song source selected')
      try {
        return await fetchSourceCatalog(source, setProgress)
      } finally {
        setProgress(null)
      }
    },
  })

  return {
    candidates: query.data ?? [],
    isFetching: query.isFetching,
    error: query.error,
    progress,
    refetch: query.refetch,
  }
}
