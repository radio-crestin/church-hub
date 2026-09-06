import { isAppFrontmost } from '~/utils/isAppFrontmost'

/**
 * Re-asserts keyboard focus now and again after each delay, for as long as
 * Church Hub is still the frontmost application.
 *
 * A projection window takes the keyboard when it appears and again when its
 * fullscreen transition ends, so one ask is not enough. But a series of blind
 * asks yanks the app back over whatever the operator switched to in the
 * meantime, so every step re-checks first and the whole series is dropped on
 * the first negative check — a later timer must never resurrect it.
 *
 * Returns a cancel function for callers that stop the series themselves.
 */
export function reclaimFocusSeries(
  reclaim: () => Promise<void>,
  delays: readonly number[],
): () => void {
  let cancelled = false
  const timers: ReturnType<typeof setTimeout>[] = []

  const cancel = (): void => {
    cancelled = true
    for (const timer of timers) clearTimeout(timer)
    timers.length = 0
  }

  const step = async (): Promise<void> => {
    if (cancelled) return
    if (!(await isAppFrontmost())) {
      cancel()
      return
    }
    await reclaim()
  }

  void step()
  for (const delay of delays) {
    timers.push(setTimeout(() => void step(), delay))
  }

  return cancel
}
