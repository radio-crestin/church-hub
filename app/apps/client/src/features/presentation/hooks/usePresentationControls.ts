import { useMutation, useQueryClient } from '@tanstack/react-query'

import { presentationStateQueryKey } from './usePresentationState'
import {
  clearLiveHighlights,
  clearSlide,
  clearTemporaryContent,
  navigateQueueSlide,
  navigateTemporary,
  presentTemporaryBible,
  presentTemporarySong,
  showSlide,
  stopPresentation,
  updateLiveHighlights,
  updatePresentationState,
} from '../service/presentation'
import type { LiveHighlight, PresentationState } from '../types'

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
      queryClient.setQueryData(presentationStateQueryKey, data)
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
    mutationFn: navigateTemporary,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
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

// ============================================================================
// LIVE HIGHLIGHTS HOOKS (in-memory only, for temporary highlighting)
// ============================================================================

export function useUpdateLiveHighlights() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (highlights: LiveHighlight[]) =>
      updateLiveHighlights(highlights),
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}

export function useClearLiveHighlights() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearLiveHighlights,
    onSuccess: (data: PresentationState) => {
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
}
