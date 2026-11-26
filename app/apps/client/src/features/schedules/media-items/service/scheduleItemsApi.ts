import type { PresentationState } from '~/features/presentation'
import { fetcher } from '~/utils/fetcher'
import type { ScheduleItem } from '../../types'
import type { ItemConfig } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** Changes an item's settings; its random picks are made again. */
export async function setScheduleItemConfig(
  scheduleId: number,
  itemId: number,
  itemConfig: ItemConfig,
): Promise<ScheduleItem> {
  const response = await fetcher<ApiResponse<ScheduleItem>>(
    `/api/schedules/${scheduleId}/items/${itemId}/config`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemConfig }),
    },
  )
  if (!response.data) throw new Error(response.error ?? 'Settings not saved')
  return response.data
}

/** A music item plays now, from its first track. */
export async function playMusicItem(
  scheduleId: number,
  itemId: number,
): Promise<void> {
  await fetcher(`/api/schedules/${scheduleId}/items/${itemId}/play`, {
    method: 'POST',
  })
}

/** The presentation picks its random verses and videos again. */
export async function repickSchedule(scheduleId: number): Promise<void> {
  await fetcher(`/api/schedules/${scheduleId}/repick`, { method: 'POST' })
}

/**
 * A step of the presentation goes up, built by the server (a video, a deck's
 * slide); answers with the presentation state.
 */
export async function presentScheduleStep(
  scheduleId: number,
  stepIndex: number,
): Promise<PresentationState> {
  const response = await fetcher<ApiResponse<PresentationState>>(
    `/api/schedules/${scheduleId}/steps/${stepIndex}/present`,
    { method: 'POST' },
  )
  if (!response.data) throw new Error(response.error ?? 'Step not presented')
  return response.data
}
