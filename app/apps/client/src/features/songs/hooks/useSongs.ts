import { useQuery } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { getAllSongs } from '../service'
import type { Song } from '../types'

const logger = createLogger('app:songs')

export function useSongs() {
  return useQuery<Song[]>({
    queryKey: ['songs'],
    queryFn: async () => {
      logger.debug('Fetching all songs')
      const songs = await getAllSongs()
      logger.debug(`Fetched ${songs.length} songs`)
      return songs
    },
  })
}
