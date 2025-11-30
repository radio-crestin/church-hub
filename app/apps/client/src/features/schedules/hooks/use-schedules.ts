import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addScheduleItem,
  createSchedule,
  deleteSchedule,
  duplicateSchedule,
  getAllSchedules,
  getSchedule,
  removeScheduleItem,
  reorderScheduleItems,
  updateSchedule,
} from '../service/schedules'
import type {
  AddScheduleItemInput,
  CreateScheduleInput,
  ReorderItemsInput,
  UpdateScheduleInput,
} from '../service/types'

export const SCHEDULES_QUERY_KEY = ['schedules']

export function useSchedules() {
  return useQuery({
    queryKey: SCHEDULES_QUERY_KEY,
    queryFn: getAllSchedules,
  })
}

export function useSchedule(id: number | null) {
  return useQuery({
    queryKey: [...SCHEDULES_QUERY_KEY, id],
    queryFn: () => (id ? getSchedule(id) : null),
    enabled: id !== null,
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateScheduleInput) => createSchedule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateScheduleInput }) =>
      updateSchedule(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useDuplicateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => duplicateSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useAddScheduleItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      input,
    }: {
      scheduleId: number
      input: AddScheduleItemInput
    }) => addScheduleItem(scheduleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useRemoveScheduleItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      itemId,
    }: {
      scheduleId: number
      itemId: number
    }) => removeScheduleItem(scheduleId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useReorderScheduleItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      input,
    }: {
      scheduleId: number
      input: ReorderItemsInput
    }) => reorderScheduleItems(scheduleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}
