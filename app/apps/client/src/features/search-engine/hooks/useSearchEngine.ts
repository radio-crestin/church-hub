import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getSearchEngineInfo,
  setSearchEngine,
  triggerChromaResync,
} from '../service/searchEngine'
import type { SearchEngine } from '../types'

const QUERY_KEY = ['search-engine']

/**
 * Search engine info + Chroma status. Polls every 2s while the Chroma sync
 * is active so the settings panel shows live progress.
 */
export function useSearchEngine() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getSearchEngineInfo,
    refetchInterval: (q) => {
      const state = q.state.data?.chroma.state
      return state === 'syncing' || state === 'starting' ? 2_000 : 15_000
    },
  })

  const setEngine = useMutation({
    mutationFn: (engine: SearchEngine) => setSearchEngine(engine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const resync = useMutation({
    mutationFn: triggerChromaResync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  return { ...query, setEngine, resync }
}
