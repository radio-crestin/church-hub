const MIN_SECONDS = 1
const MAX_SECONDS = 3600

/** A slide's time on screen, in whole seconds from 1 s to an hour. */
export function clampSeconds(value: number): number {
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(value)))
}
