import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { presentationStateQueryKey } from './usePresentationState'
import {
  clearSlide,
  clearTemporaryContent,
  navigateQueueSlide,
  navigateTemporary,
  presentTemporaryAnnouncement,
  presentTemporaryBible,
  presentTemporaryBiblePassage,
  presentTemporaryScene,
  presentTemporarySong,
  presentTemporaryVerseteTineri,
  showSlide,
  stopPresentation,
  updatePresentationState,
} from '../service/presentation'
import type { PresentationState } from '../types'

const logger = createLogger('PresentationControls')

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
    logger.debug(
      `Applying state update: updatedAt=${newState.updatedAt}, isHidden=${newState.isHidden}, lastApplied=${lastAppliedUpdatedAt}`,
    )
    lastAppliedUpdatedAt = newState.updatedAt
    queryClient.setQueryData(presentationStateQueryKey, newState)
    return true
  }
  logger.debug(
    `Rejecting stale state: updatedAt=${newState.updatedAt} <= lastApplied=${lastAppliedUpdatedAt}`,
  )
  return false
}

/**
 * Helper to set presentation state from mutation responses.
 * CRITICAL: Only applies state if it's newer than the last applied state.
 * This prevents stale HTTP responses (arriving out of order) from overwriting
 * newer state during rapid show -> hide -> show cycles.
 */
export function setStateFromMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  newState: PresentationState,
): void {
  logger.debug(
    `Mutation setting state: updatedAt=${newState.updatedAt}, isHidden=${newState.isHidden}, prev lastApplied=${lastAppliedUpdatedAt}`,
  )
  // Only apply state if this is newer than the last applied
  // This prevents stale HTTP responses from overwriting newer state
  if (newState.updatedAt > lastAppliedUpdatedAt) {
    lastAppliedUpdatedAt = newState.updatedAt
    queryClient.setQueryData(presentationStateQueryKey, newState)
    logger.debug(
      `Mutation state APPLIED: updatedAt=${newState.updatedAt}, isHidden=${newState.isHidden}`,
    )
  } else {
    logger.debug(
      `Mutation state REJECTED (stale): ${newState.updatedAt} <= ${lastAppliedUpdatedAt}`,
    )
  }
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
    onSuccess: async (data: PresentationState) => {
      // Cancel any in-flight queries to prevent them from overwriting our update
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      setStateFromMutation(queryClient, data)
    },
  })
}

export function useClearSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearSlide,
    onSuccess: async (data: PresentationState) => {
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      setStateFromMutation(queryClient, data)
    },
  })
}

export function useShowSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: showSlide,
    onSuccess: async (data: PresentationState) => {
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      setStateFromMutation(queryClient, data)
    },
  })
}

export function useUpdatePresentationState() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePresentationState,
    onSuccess: async (data: PresentationState) => {
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      setStateFromMutation(queryClient, data)
    },
  })
}

export function useNavigateQueueSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: navigateQueueSlide,
    onSuccess: async (data: PresentationState) => {
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
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
    onSuccess: async (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      // Use setStateFromMutation to update lastAppliedUpdatedAt after reset
      setStateFromMutation(queryClient, data)
    },
  })
}

export function usePresentTemporarySong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporarySong,
    onMutate: async () => {
      // Cancel any in-flight queries to prevent them from overwriting our update
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
    },
    onSuccess: (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      // Use setStateFromMutation to update lastAppliedUpdatedAt after reset
      setStateFromMutation(queryClient, data)
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
    onSuccess: async (data: PresentationState) => {
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      updateStateIfNewer(queryClient, data)
    },
  })
}

export function useClearTemporaryContent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearTemporaryContent,
    onSuccess: async (data: PresentationState) => {
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      setStateFromMutation(queryClient, data)
    },
  })
}

export function usePresentTemporaryAnnouncement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryAnnouncement,
    onSuccess: async (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      // Use setStateFromMutation to update lastAppliedUpdatedAt after reset
      setStateFromMutation(queryClient, data)
    },
  })
}

export function usePresentTemporaryBiblePassage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryBiblePassage,
    onSuccess: async (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      // Use setStateFromMutation to update lastAppliedUpdatedAt after reset
      setStateFromMutation(queryClient, data)
    },
  })
}

export function usePresentTemporaryVerseteTineri() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryVerseteTineri,
    onSuccess: async (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      // Use setStateFromMutation to update lastAppliedUpdatedAt after reset
      setStateFromMutation(queryClient, data)
    },
  })
}

export function usePresentTemporaryScene() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporaryScene,
    onSuccess: async (data: PresentationState) => {
      // Reset tracking when presenting new content
      resetNavigationTracking()
      await queryClient.cancelQueries({ queryKey: presentationStateQueryKey })
      // Use setStateFromMutation to update lastAppliedUpdatedAt after reset
      setStateFromMutation(queryClient, data)
    },
  })
}
