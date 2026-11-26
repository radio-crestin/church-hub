import { fetcher } from '~/utils/fetcher'
import type { ScheduleAutomationState } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** The query the runner's state lives in; the WebSocket keeps it current. */
export const scheduleAutomationQueryKey = ['scheduleAutomation'] as const

export async function getScheduleAutomation(): Promise<ScheduleAutomationState> {
  const response = await fetcher<ApiResponse<ScheduleAutomationState>>(
    '/api/schedules/automation',
  )
  return response.data ?? { running: false }
}

/** Starts a presentation from its first step (autoplay runs on the server). */
export async function runSchedule(
  id: number,
): Promise<ScheduleAutomationState> {
  const response = await fetcher<ApiResponse<ScheduleAutomationState>>(
    `/api/schedules/${id}/run`,
    { method: 'POST' },
  )
  if (response.error) throw new Error(response.error)
  return response.data ?? { running: false }
}

/** Stops the running presentation and takes it off the screens. */
export async function stopScheduleAutomation(): Promise<ScheduleAutomationState> {
  const response = await fetcher<ApiResponse<ScheduleAutomationState>>(
    '/api/schedules/automation/stop',
    { method: 'POST' },
  )
  return response.data ?? { running: false }
}
