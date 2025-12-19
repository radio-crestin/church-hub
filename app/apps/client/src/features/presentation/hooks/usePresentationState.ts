import { useQuery } from '@tanstack/react-query'

import { getPresentationState } from '../service/presentation'

export const presentationStateQueryKey = ['presentation', 'state']

export function usePresentationState() {
  return useQuery({
    queryKey: presentationStateQueryKey,
    queryFn: getPresentationState,
    // Use longer polling as fallback - WebSocket handles real-time updates
    refetchInterval: 10000,
    // Keep data fresh on window focus
    refetchOnWindowFocus: true,
  })
}
