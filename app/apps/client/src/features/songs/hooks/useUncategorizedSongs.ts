import { useQuery } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { getSongsPaginated, type PaginatedSongsResult } from '../service'

const logger = createLogger('app:songs')

// Enough for the settings card's scroll list; `total` still counts them all.
const UNCATEGORIZED_PAGE_SIZE = 200

/**
 * Songs without a category, A→Z, for the settings "Uncategorized" card.
 * Asks the server for just those songs instead of the whole library.
 */
export function useUncategorizedSongs() {
  return useQuery<PaginatedSongsResult>({
    queryKey: ['songs', 'uncategorized'],
    queryFn: async ({ signal }) => {
      const page = await getSongsPaginated(
        UNCATEGORIZED_PAGE_SIZE,
        0,
        { uncategorizedOnly: true, sortBy: 'title' },
        signal,
      )
      logger.debug(`Fetched ${page.songs.length}/${page.total} uncategorized`)
      return page
    },
  })
}
