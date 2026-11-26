import { usePresentationState } from '~/features/presentation'
import { useScheduleAutomation } from './useScheduleAutomation'
import { derivePresentedScheduleInfo } from '../utils/presentedScheduleInfo'

/**
 * The presentation running in the control room's place: the one whose step
 * is on the screens, else the one running by itself; null when it is the
 * queue (`queueId`) or nothing.
 */
export function useRunningProgramId(queueId: number | null): number | null {
  const { data: state } = usePresentationState()
  const { data: automation } = useScheduleAutomation()
  const liveId =
    derivePresentedScheduleInfo(state?.temporaryContent)?.scheduleId ?? null
  const runnerId = automation?.running ? automation.scheduleId : null
  const running = liveId ?? runnerId
  return running !== null && running !== queueId ? running : null
}
