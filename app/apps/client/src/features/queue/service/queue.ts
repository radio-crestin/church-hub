import { fetcher } from '~/utils/fetcher'
import type {
  AddToQueueInput,
  InsertBiblePassageInput,
  InsertBibleVerseInput,
  InsertSlideInput,
  QueueItem,
  ReorderQueueInput,
  UpdateSlideInput,
} from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getQueue(): Promise<QueueItem[]> {
  const response = await fetcher<ApiResponse<QueueItem[]>>('/api/queue')
  return response.data ?? []
}

export async function addToQueue(
  input: AddToQueueInput,
): Promise<{ success: boolean; data?: QueueItem; error?: string }> {
  const response = await fetcher<ApiResponse<QueueItem>>('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function removeFromQueue(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/queue/${id}`,
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}

export async function clearQueue(): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    '/api/queue',
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}

export async function reorderQueue(input: ReorderQueueInput): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    '/api/queue/reorder',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return response.data?.success ?? false
}

export async function setQueueItemExpanded(
  id: number,
  expanded: boolean,
): Promise<QueueItem | null> {
  const response = await fetcher<ApiResponse<QueueItem>>(
    `/api/queue/${id}/expand`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expanded }),
    },
  )
  return response.data ?? null
}

export async function insertSlideToQueue(
  input: InsertSlideInput,
): Promise<{ success: boolean; data?: QueueItem; error?: string }> {
  const response = await fetcher<ApiResponse<QueueItem>>('/api/queue/slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function updateSlideInQueue(
  input: UpdateSlideInput,
): Promise<{ success: boolean; data?: QueueItem; error?: string }> {
  const response = await fetcher<ApiResponse<QueueItem>>(
    `/api/queue/slide/${input.id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slideType: input.slideType,
        slideContent: input.slideContent,
      }),
    },
  )

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function insertBibleVerseToQueue(
  input: InsertBibleVerseInput,
): Promise<{ success: boolean; data?: QueueItem; error?: string }> {
  const response = await fetcher<ApiResponse<QueueItem>>('/api/queue/bible', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}

export async function insertBiblePassageToQueue(
  input: InsertBiblePassageInput,
): Promise<{ success: boolean; data?: QueueItem; error?: string }> {
  const response = await fetcher<ApiResponse<QueueItem>>(
    '/api/queue/bible-passage',
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

export async function saveQueueAsSchedule(title: string): Promise<{
  success: boolean
  data?: { scheduleId: number }
  error?: string
}> {
  const response = await fetcher<{
    success?: boolean
    data?: { scheduleId: number }
    error?: string
  }>('/api/queue/export-to-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, data: response.data }
}
