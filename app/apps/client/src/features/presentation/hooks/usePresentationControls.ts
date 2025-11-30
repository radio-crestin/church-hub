import { useMutation, useQueryClient } from '@tanstack/react-query'

import { presentationStateQueryKey } from './usePresentationState'
import {
  clearSlide,
  navigateSlide,
  startPresentation,
  stopPresentation,
  updatePresentationState,
} from '../service/displays'

export function useStartPresentation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startPresentation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })
    },
  })
}

export function useStopPresentation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: stopPresentation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })
    },
  })
}

export function useNavigateSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: navigateSlide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })
    },
  })
}

export function useClearSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearSlide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })
    },
  })
}

export function useUpdatePresentationState() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePresentationState,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })
    },
  })
}
