import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  type PresentationState,
  presentationStateQueryKey,
} from '~/features/presentation'
import {
  resetNavigationTracking,
  setStateFromMutation,
} from '~/features/presentation/hooks/usePresentationControls'
import { presentScheduleStep } from '../service/scheduleItemsApi'

/**
 * Puts a step the server builds (a video, a deck's slide) up, and takes the
 * state it answers with at once, like the other present mutations: the next
 * Down, queued behind it, moves on from this step without waiting for the
 * WebSocket.
 */
export function usePresentScheduleStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      scheduleId,
      stepIndex,
    }: {
      scheduleId: number
      stepIndex: number
    }) => presentScheduleStep(scheduleId, stepIndex),
    onSuccess: async (state: PresentationState) => {
      resetNavigationTracking()
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      setStateFromMutation(queryClient, state)
    },
  })
}
