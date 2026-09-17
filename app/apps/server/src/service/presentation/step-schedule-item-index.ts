/**
 * The program position of the step reached by moving within the item on the
 * projector, from its step `fromIndex` to `toIndex`.
 *
 * Content presented as a program step carries its place in the program's flat
 * run, one position per slide, verse or entry. Moving to the next slide of that
 * song is one position on, and leaving the position behind made every screen
 * light the step the item was first presented at — and a program's next/prev,
 * which steps from that position, jump back to it or into the item before.
 * Content that is not a program step has no position to move.
 */
export function stepScheduleItemIndex(
  scheduleItemIndex: number | undefined,
  fromIndex: number,
  toIndex: number,
): number | undefined {
  if (scheduleItemIndex === undefined || scheduleItemIndex < 0) {
    return scheduleItemIndex
  }
  return scheduleItemIndex + (toIndex - fromIndex)
}
