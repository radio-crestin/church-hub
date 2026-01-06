import { fetcher } from '~/utils/fetcher'
import type {
  AddToScheduleInput,
  ReorderScheduleItemsInput,
  ReplaceScheduleItemsInput,
  Schedule,
  ScheduleItem,
  ScheduleSearchResult,
  ScheduleWithItems,
  UpdateScheduleSlideInput,
  UpsertScheduleInput,
} from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getAllSchedules(): Promise<Schedule[]> {
  const response = await fetcher<ApiResponse<Schedule[]>>('/api/schedules')
  return response.data ?? []
}

export async function getScheduleById(
  id: number,
): Promise<ScheduleWithItems | null> {
  const response = await fetcher<ApiResponse<ScheduleWithItems>>(
    `/api/schedules/${id}`,
  )
  return response.data ?? null
}

export async function upsertSchedule(
  input: UpsertScheduleInput,
): Promise<{ success: boolean; data?: Schedule; error?: string }> {
  const response = await fetcher<ApiResponse<Schedule>>('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function deleteSchedule(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/schedules/${id}`,
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}

export async function searchSchedules(
  query: string,
): Promise<ScheduleSearchResult[]> {
  const response = await fetcher<ApiResponse<ScheduleSearchResult[]>>(
    `/api/schedules/search?q=${encodeURIComponent(query)}`,
  )
  return response.data ?? []
}

export async function addItemToSchedule(
  scheduleId: number,
  input: AddToScheduleInput,
): Promise<{ success: boolean; data?: ScheduleItem; error?: string }> {
  const response = await fetcher<ApiResponse<ScheduleItem>>(
    `/api/schedules/${scheduleId}/items`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function removeItemFromSchedule(
  scheduleId: number,
  itemId: number,
): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/schedules/${scheduleId}/items/${itemId}`,
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}

export async function updateScheduleSlide(
  scheduleId: number,
  itemId: number,
  input: UpdateScheduleSlideInput,
): Promise<{ success: boolean; data?: ScheduleItem; error?: string }> {
  const response = await fetcher<ApiResponse<ScheduleItem>>(
    `/api/schedules/${scheduleId}/items/${itemId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function reorderScheduleItems(
  scheduleId: number,
  input: ReorderScheduleItemsInput,
): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/schedules/${scheduleId}/items/reorder`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return response.data?.success ?? false
}

export async function replaceScheduleItems(
  scheduleId: number,
  input: ReplaceScheduleItemsInput,
): Promise<{
  success: boolean
  schedule?: { id: number; title: string; itemCount: number }
  skippedItems?: Array<{
    index: number
    type: 'bible_passage' | 'versete_tineri_entry'
    reference: string
    reason: string
  }>
  error?: string
}> {
  const response = await fetcher<
    ApiResponse<{
      success: boolean
      schedule?: { id: number; title: string; itemCount: number }
      skippedItems?: Array<{
        index: number
        type: 'bible_passage' | 'versete_tineri_entry'
        reference: string
        reason: string
      }>
    }>
  >(`/api/schedules/${scheduleId}/items/replace`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return {
    success: response.data?.success ?? false,
    schedule: response.data?.schedule,
    skippedItems: response.data?.skippedItems,
  }
}
