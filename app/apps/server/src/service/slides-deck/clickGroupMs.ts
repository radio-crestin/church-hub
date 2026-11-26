import type { DeckClickGroup } from './types'

/** How long a click group plays, from its click to its last effect's end. */
export function clickGroupMs(group: DeckClickGroup): number {
  return group.reduce(
    (end, { animation, startMs }) =>
      Math.max(end, startMs + animation.durationMs),
    0,
  )
}
