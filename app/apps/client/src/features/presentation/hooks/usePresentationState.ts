import { useQuery } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { getPresentationState } from '../service/presentation'

const logger = createLogger('app:presentation:state')

export const presentationStateQueryKey = ['presentation', 'state']

export function usePresentationState() {
  return useQuery({
    queryKey: presentationStateQueryKey,
    queryFn: async () => {
      logger.debug('Polling presentation state')
      const state = await getPresentationState()
      logger.debug(
        `State polled: isHidden=${state.isHidden}, updatedAt=${state.updatedAt}, queueItemId=${state.currentQueueItemId}, songSlideId=${state.currentSongSlideId}`,
      )
      return state
    },
    // Use longer polling as fallback - WebSocket handles real-time updates
    refetchInterval: 10000,
    // Keep data fresh on window focus
    refetchOnWindowFocus: true,
    // Consider data fresh for 5 seconds to reduce unnecessary refetches
    staleTime: 5000,
  })
}
