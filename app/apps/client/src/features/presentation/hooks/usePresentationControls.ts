import { useMutation, useQueryClient } from '@tanstack/react-query'

import { presentationStateQueryKey } from './usePresentationState'
import {
  clearSlide,
  navigateSlide,
  showSlide,
  startPresentation,
  stopPresentation,
  updatePresentationState,
} from '../service/displays'
import type { PresentationState } from '../types'

export function useStartPresentation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startPresentation,
    onSuccess: (data: PresentationState) => {
      // Update cache directly with response data instead of refetching
      queryClient.setQueryData(presentationStateQueryKey, data)
    },
  })
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

export function useNavigateSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: navigateSlide,
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
