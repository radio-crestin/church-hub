import { useMutation, useQueryClient } from '@tanstack/react-query'

import { presentationStateQueryKey } from './usePresentationState'
import {
  clearSlide,
  clearTemporaryContent,
  navigateQueueSlide,
  navigateTemporary,
  presentTemporaryAnnouncement,
  presentTemporaryBible,
  presentTemporaryBiblePassage,
  presentTemporarySong,
  presentTemporaryVerseteTineri,
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
 * Promise queue for serializing navigation requests.
 * Ensures each navigation completes before the next one starts,
 * preventing race conditions where multiple requests read stale state.
 */
let navigationQueue: Promise<unknown> = Promise.resolve()

/**
 * Tracks the last applied updatedAt timestamp.
 * Shared between HTTP responses and WebSocket to ensure consistent ordering.
 */
let lastAppliedUpdatedAt = 0

/**
 * Helper to update presentation state only if the new state is newer.
 * Uses server's updatedAt (which is monotonically increasing) for ordering.
 * Exported so WebSocket handler can use the same logic.
 * Returns true if the state was applied, false if it was stale.
 */
export function updateStateIfNewer(
  queryClient: ReturnType<typeof useQueryClient>,
  newState: PresentationState,
): boolean {
  // Only apply if this state is newer than the last applied
  if (newState.updatedAt > lastAppliedUpdatedAt) {
    lastAppliedUpdatedAt = newState.updatedAt
    queryClient.setQueryData(presentationStateQueryKey, newState)
    return true
  }
  return false
}

/**
 * Reset the tracking when presenting new content.
 */
export function resetNavigationTracking(): void {
  lastAppliedUpdatedAt = 0
  lastRequestTimestamp = 0
  navigationQueue = Promise.resolve()
}

/**
 * Get the last applied updatedAt timestamp for debugging.
 */
export function getLastAppliedUpdatedAt(): number {
  return lastAppliedUpdatedAt
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
    mutationFn: (input: { direction: 'next' | 'prev' }) => {
      // Chain this navigation to the queue to ensure sequential processing
      // This prevents race conditions where multiple requests read stale state
      const navigationPromise = navigationQueue.then(() =>
        navigateTemporary({
          direction: input.direction,
          requestTimestamp: getUniqueTimestamp(),
        }),
      )
      // Update the queue to wait for this navigation to complete
      // Use .catch to prevent queue from breaking on errors
      navigationQueue = navigationPromise.catch(() => {})
      return navigationPromise
    },
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

export function usePresentTemporaryAnnouncement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryAnnouncement,
    onSuccess: (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function usePresentTemporaryBiblePassage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryBiblePassage,
    onSuccess: (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function usePresentTemporaryVerseteTineri() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryVerseteTineri,
    onSuccess: (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}
