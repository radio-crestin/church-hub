import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

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
 * Tracks the last successfully applied response sequence.
 * Used to prevent stale responses from overwriting newer state.
 */
let lastAppliedSequence = 0

/**
 * Helper to update presentation state only if the response is from a newer request.
 * Uses request sequence numbers to handle out-of-order responses.
 */
function updateStateIfNewer(
  queryClient: ReturnType<typeof useQueryClient>,
  newState: PresentationState,
  requestSequence: number,
): void {
  // Only apply if this response is from a newer request than the last applied
  if (requestSequence > lastAppliedSequence) {
    lastAppliedSequence = requestSequence
    queryClient.setQueryData(presentationStateQueryKey, newState)
  }
}

/**
 * Reset the applied sequence when presenting new content.
 * This allows the first navigation after presenting to be applied.
 */
export function resetNavigationSequence(): void {
  lastAppliedSequence = 0
  // Also reset the server-side timestamp tracker
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

// Navigation sequence counter for queue slide navigation
let queueNavigationSequence = 0

export function useNavigateQueueSlide() {
  const queryClient = useQueryClient()
  const sequenceRef = useRef(0)

  return useMutation({
    mutationFn: async (direction: 'next' | 'prev') => {
      queueNavigationSequence++
      sequenceRef.current = queueNavigationSequence
      return navigateQueueSlide(direction)
    },
    onSuccess: (data: PresentationState) => {
      updateStateIfNewer(queryClient, data, sequenceRef.current)
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
      // Reset navigation sequence when presenting new content
      resetNavigationSequence()
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function usePresentTemporarySong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: presentTemporarySong,
    onSuccess: (data: PresentationState) => {
      // Reset navigation sequence when presenting new content
      resetNavigationSequence()
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

// Navigation sequence counter for temporary content navigation
let temporaryNavigationSequence = 0

export function useNavigateTemporary() {
  const queryClient = useQueryClient()
  const sequenceRef = useRef(0)

  return useMutation({
    mutationFn: async (input: { direction: 'next' | 'prev' }) => {
      temporaryNavigationSequence++
      sequenceRef.current = temporaryNavigationSequence
      return navigateTemporary({
        direction: input.direction,
        requestTimestamp: getUniqueTimestamp(),
      })
    },
    onSuccess: (data: PresentationState) => {
      updateStateIfNewer(queryClient, data, sequenceRef.current)
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
