import { useQuery } from '@tanstack/react-query'

import {
  getSongsPaginated,
  type PaginatedSongsResult,
  type SongFilters,
} from '../service'

// Alphabet fast-scroll needs every matching song loaded at once so any letter
// can be jumped to instantly. The server applies no upper bound on `limit`, so
// a single large request is cheaper than walking ~N paginated pages.
const ALPHABET_FETCH_LIMIT = 100000

/**
 * Loads the full, alphabetically sorted song list for the fast-scroll rail.
 *
 * Always requests `sortBy: 'title'` regardless of the incoming filter so the
 * payload is pre-ordered; the client still re-sorts for diacritic-aware
 * grouping. Disabled (no request) unless `enabled` is true, so it never fires
 * in search / last-played browse modes.
 */
export function useAllSongsAlphabetical(
  filters: SongFilters,
  enabled: boolean,
) {
  return useQuery<PaginatedSongsResult>({
    queryKey: ['songs', 'alphabetical', filters],
    queryFn: ({ signal }) =>
      getSongsPaginated(
        ALPHABET_FETCH_LIMIT,
        0,
        { ...filters, sortBy: 'title' },
        signal,
      ),
    enabled,
    staleTime: 0,
  })
}
