/**
 * The step each program was last seen live at, by program id. Kept in memory
 * only: a position means something during the service it was reached in, not
 * after a restart.
 */
const lastPositions = new Map<number, number>()

/** Notes the step a program is live at. */
export function rememberProgramPosition(
  scheduleId: number,
  flatIndex: number,
): void {
  lastPositions.set(scheduleId, flatIndex)
}

/**
 * Where the program was last live, or -1 when it has not been live since the
 * app started. Once a song is put up on its own the program is no longer live,
 * and this is what tells Next which of the song's occurrences it had reached.
 */
export function readProgramPosition(
  scheduleId: number | null | undefined,
): number {
  if (!scheduleId) return -1
  return lastPositions.get(scheduleId) ?? -1
}
