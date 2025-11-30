import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addToQueue,
  addToQueueAndPresent,
  clearQueue,
  getQueueState,
  nextQueueItem,
  removeFromQueue,
  setCurrentSlide,
} from '../service/presentation'
import type { AddToQueueInput } from '../service/types'

export const QUEUE_QUERY_KEY = ['queue']

export function useQueue() {
  return useQuery({
    queryKey: QUEUE_QUERY_KEY,
    queryFn: getQueueState,
    refetchInterval: 5000, // Refetch every 5 seconds as backup to WebSocket
  })
}

export function useAddToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddToQueueInput) => addToQueue(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
    },
  })
}

export function useAddToQueueAndPresent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddToQueueInput) => addToQueueAndPresent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
    },
  })
}

export function useRemoveFromQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (queueItemId: number) => removeFromQueue(queueItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
    },
  })
}

export function useNextQueueItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => nextQueueItem(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
    },
  })
}

export function useClearQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => clearQueue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
    },
  })
}

export function useSetCurrentSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sessionId,
      slideIndex,
    }: {
      sessionId: number
      slideIndex: number
    }) => setCurrentSlide(sessionId, slideIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
    },
  })
}
