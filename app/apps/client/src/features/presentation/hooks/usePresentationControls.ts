import { useMutation, useQueryClient } from '@tanstack/react-query'

import { presentationStateQueryKey } from './usePresentationState'
import {
  clearSlide,
  clearTemporaryContent,
  navigateQueueSlide,
  navigateTemporary,
  presentTemporaryBible,
  presentTemporarySong,
  showSlide,
  stopPresentation,
  updatePresentationState,
} from '../service/presentation'
import type { PresentationState } from '../types'

/**
 * Helper to update presentation state only if the new state is newer than cached.
 * Prevents race conditions when responses arrive out of order.
 */
function updateStateIfNewer(
  queryClient: ReturnType<typeof useQueryClient>,
  newState: PresentationState,
): void {
  const currentState = queryClient.getQueryData<PresentationState>(
    presentationStateQueryKey,
  )

  // Only update if new state is newer (or no current state exists)
  if (!currentState || newState.updatedAt >= currentState.updatedAt) {
    queryClient.setQueryData(presentationStateQueryKey, newState)
  }
}

export function useStopPresentation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: stopPresentation,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function useClearSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearSlide,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function useShowSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: showSlide,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function useUpdatePresentationState() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePresentationState,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function useNavigateQueueSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: navigateQueueSlide,
    onSuccess: (data: PresentationState) => {
      updateStateIfNewer(queryClient, data)
    },
  })
}

// ============================================================================
// TEMPORARY CONTENT HOOKS (bypasses queue for instant display)
// ============================================================================

export function usePresentTemporaryBible() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryBible,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function usePresentTemporarySong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporarySong,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function useNavigateTemporary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { direction: 'next' | 'prev' }) =>
      navigateTemporary({
        direction: input.direction,
        requestTimestamp: Date.now(),
      }),
    onSuccess: (data: PresentationState) => {
      updateStateIfNewer(queryClient, data)
    },
  })
}

export function useClearTemporaryContent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearTemporaryContent,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}
