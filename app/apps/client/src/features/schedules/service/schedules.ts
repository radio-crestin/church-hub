import type {
  AddScheduleItemInput,
  ApiResponse,
  CreateScheduleInput,
  OperationResult,
  ReorderItemsInput,
  Schedule,
  ScheduleWithItems,
  UpdateScheduleInput,
} from './types'
import { fetcher } from '../../../utils/fetcher'

/**
 * Get all schedules
 */
export async function getAllSchedules(): Promise<Schedule[]> {
  try {
    const response = await fetcher<ApiResponse<Schedule[]>>('/api/schedules')
    if (response.error) {
      return []
    }
    return response.data ?? []
  } catch (_error) {
    return []
  }
}

/**
 * Get a schedule with its items
 */
export async function getSchedule(
  id: number,
): Promise<ScheduleWithItems | null> {
  try {
    const response = await fetcher<ApiResponse<ScheduleWithItems>>(
      `/api/schedules/${id}`,
    )
    if (response.error) {
      return null
    }
    return response.data ?? null
  } catch (_error) {
    return null
  }
}

/**
 * Create a new schedule
 */
export async function createSchedule(
  input: CreateScheduleInput,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      '/api/schedules',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Update a schedule
 */
export async function updateSchedule(
  id: number,
  input: UpdateScheduleInput,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `/api/schedules/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(id: number): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `/api/schedules/${id}`,
      {
        method: 'DELETE',
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Duplicate a schedule
 */
export async function duplicateSchedule(id: number): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `/api/schedules/${id}/duplicate`,
      {
        method: 'POST',
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Add an item to a schedule
 */
export async function addScheduleItem(
  scheduleId: number,
  input: AddScheduleItemInput,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `/api/schedules/${scheduleId}/items`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Remove an item from a schedule
 */
export async function removeScheduleItem(
  scheduleId: number,
  itemId: number,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `/api/schedules/${scheduleId}/items/${itemId}`,
      {
        method: 'DELETE',
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Reorder items in a schedule
 */
export async function reorderScheduleItems(
  scheduleId: number,
  input: ReorderItemsInput,
): Promise<OperationResult> {
  try {
    const response = await fetcher<ApiResponse<OperationResult>>(
      `/api/schedules/${scheduleId}/reorder`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )
    if (response.error) {
      return { success: false, error: response.error }
    }
    return response.data ?? { success: false, error: 'Unknown error' }
  } catch (_error) {
    return { success: false, error: 'Network error' }
  }
}
