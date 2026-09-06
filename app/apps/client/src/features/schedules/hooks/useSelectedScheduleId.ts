import { useSyncExternalStore } from 'react'

import {
  readSelectedScheduleId,
  subscribeSelectedScheduleId,
} from '../service/selectedSchedule'

/**
 * The program the Programe panel has selected, as reactive state. Pages use it
 * to decide whether next/prev should walk the program instead of the page's own
 * content — so the answer has to change the moment the operator picks another
 * program in the panel.
 */
export function useSelectedScheduleId(): number | null {
  return useSyncExternalStore(
    subscribeSelectedScheduleId,
    readSelectedScheduleId,
    () => null,
  )
}
