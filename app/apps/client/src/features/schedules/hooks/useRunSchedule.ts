import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  runSchedule,
  scheduleAutomationQueryKey,
  stopScheduleAutomation,
} from '../service/scheduleAutomation'

/** Run / Stop of a presentation: the runner's state comes back with each. */
export function useRunSchedule() {
  const queryClient = useQueryClient()
  const onSuccess = (state: Awaited<ReturnType<typeof runSchedule>>) => {
    queryClient.setQueryData(scheduleAutomationQueryKey, state)
  }

  const run = useMutation({ mutationFn: runSchedule, onSuccess })
  const stop = useMutation({ mutationFn: stopScheduleAutomation, onSuccess })
  return { run, stop }
}
