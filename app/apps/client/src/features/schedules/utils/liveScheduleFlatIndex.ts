import type { TemporaryContent } from '~/features/presentation'
import { derivePresentedScheduleInfo } from './presentedScheduleInfo'

/**
 * Where the projector is in a program's flat run: the position of the live step
 * when the live content came from that program, otherwise -1. A song presented
 * straight from the song page carries no `scheduleId`, and must not light up a
 * row of any program.
 */
export function liveScheduleFlatIndex(
  temporaryContent: TemporaryContent | null | undefined,
  scheduleId: number | null | undefined,
): number {
  const presented = derivePresentedScheduleInfo(temporaryContent)
  if (!presented || !scheduleId || presented.scheduleId !== scheduleId) {
    return -1
  }
  return Math.max(presented.scheduleItemIndex, -1)
}
