import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { ImportProgress } from '~/features/song-import'
import { getProvider } from '../providers'
import type { DiscoveryCandidate } from '../types'

/**
 * Downloads + parses a source provider's catalog, cached in React Query for an
 * hour so revisiting the screen (or re-running the diff) doesn't re-download
 * the multi-MB archive. `progress` tracks the in-flight download/parse phases;
 * `refetch` forces a fresh pull ("Refresh catalog").
 */
export function useFetchCatalog(providerId: string | null) {
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  const query = useQuery<DiscoveryCandidate[]>({
    queryKey: ['discovery-catalog', providerId],
    enabled: providerId != null,
    staleTime: 1000 * 60 * 60, // 1h — external catalogs change rarely
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: async () => {
      const provider = providerId ? getProvider(providerId) : undefined
      if (!provider) throw new Error(`Unknown source provider: ${providerId}`)
      try {
        return await provider.fetchCatalog(setProgress)
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
