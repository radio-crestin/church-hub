import { usePresentationState } from '~/features/presentation'
import {
  type ScheduleFlatNavigation,
  useScheduleFlatNavigation,
} from './useScheduleFlatNavigation'
import { derivePresentedScheduleInfo } from '../utils/presentedScheduleInfo'

/**
 * The program whose step is on the projector, ready to walk from any page —
 * what next/prev fall back to where the open page has no running order of its
 * own. Null while nothing from a program is live, and while that program's
 * running order is still loading: walking an empty run would end the
 * presentation instead of moving it on.
 */
export function useLiveProgramNavigation(): ScheduleFlatNavigation | null {
  const { data: presentationState } = usePresentationState()
  const liveScheduleId =
    derivePresentedScheduleInfo(presentationState?.temporaryContent)
      ?.scheduleId ?? null
  const nav = useScheduleFlatNavigation({ scheduleId: liveScheduleId })
  return nav.isScheduleLive && nav.flatItems.length > 0 ? nav : null
}
