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
 * Generates a unique, monotonically increasing timestamp.
 * Handles rapid calls within the same millisecond by incrementing.
 */
let lastRequestTimestamp = 0
function getUniqueTimestamp(): number {
  const now = Date.now()
  // If called within the same millisecond, increment to ensure uniqueness
  if (now <= lastRequestTimestamp) {
    lastRequestTimestamp++
    return lastRequestTimestamp
  }
  lastRequestTimestamp = now
  return now
}

/**
 * Tracks the last applied updatedAt timestamp.
 * Shared between HTTP responses and WebSocket to ensure consistent ordering.
 */
let lastAppliedUpdatedAt = 0

/**
 * Helper to update presentation state only if the new state is newer.
 * Uses server's updatedAt (which is monotonically increasing) for ordering.
 * Exported so WebSocket handler can use the same logic.
 */
export function updateStateIfNewer(
  queryClient: ReturnType<typeof useQueryClient>,
  newState: PresentationState,
): void {
  // Only apply if this state is newer than the last applied
  if (newState.updatedAt > lastAppliedUpdatedAt) {
    lastAppliedUpdatedAt = newState.updatedAt
    queryClient.setQueryData(presentationStateQueryKey, newState)
  }
}

/**
 * Reset the tracking when presenting new content.
 */
export function resetNavigationTracking(): void {
  lastAppliedUpdatedAt = 0
  lastRequestTimestamp = 0
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
      // Reset tracking when presenting new content
      resetNavigationTracking()
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function usePresentTemporarySong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporarySong,
    onSuccess: (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
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
        requestTimestamp: getUniqueTimestamp(),
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
