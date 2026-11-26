import { usePresentationState } from '~/features/presentation'
import { useSchedule } from './useSchedule'
import { liveScheduleFlatIndex } from '../utils/liveScheduleFlatIndex'
import { buildScheduleFlatItems } from '../utils/scheduleFlatItems'

/** The id of the presentation's item whose step is on the screens, or null. */
export function useLiveScheduleItemId(
  scheduleId: number | null,
): number | null {
  const { data: state } = usePresentationState()
  const { data: schedule } = useSchedule(scheduleId ?? undefined)
  const index = liveScheduleFlatIndex(state?.temporaryContent, scheduleId)
  if (index < 0 || !schedule) return null
  return buildScheduleFlatItems(schedule.items)[index]?.item.id ?? null
}
