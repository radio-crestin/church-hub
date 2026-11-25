import type { DeckDirection, DeckTransition } from '../types'

/** The incoming slide's and, for a push, the outgoing one's keyframes. */
export interface DeckTransitionKeyframes {
  incoming: Keyframe[]
  outgoing: Keyframe[] | null
}

/** Off the slide box on the side the new slide comes from. */
function offBox(direction: DeckDirection): string {
  switch (direction) {
    case 'left':
      return 'translate(-100%, 0)'
    case 'right':
      return 'translate(100%, 0)'
    case 'up':
      return 'translate(0, -100%)'
    case 'down':
      return 'translate(0, 100%)'
  }
}

/** The way out for the old slide, pushed by the new one. */
function pushedOut(direction: DeckDirection): string {
  return offBox(
    ({ left: 'right', right: 'left', up: 'down', down: 'up' } as const)[
      direction
    ],
  )
}

const WIPED: Record<DeckDirection, string> = {
  left: 'inset(0% 100% 0% 0%)',
  right: 'inset(0% 0% 0% 100%)',
  up: 'inset(0% 0% 100% 0%)',
  down: 'inset(100% 0% 0% 0%)',
}
const UNCUT = 'inset(0% 0% 0% 0%)'
const IN_PLACE = 'translate(0, 0)'

/**
 * How a slide comes in over the one before it, PowerPoint's transitions:
 * Fade, Push (the old slide pushed out the other side), Wipe and Split
 * (uncovered from a side or from the centre), Cover (slides in over it) and
 * Zoom. `direction` is the side it comes from (bottom when not given).
 */
export function transitionKeyframes(
  transition: DeckTransition,
): DeckTransitionKeyframes | null {
  const direction = transition.direction ?? 'down'
  switch (transition.effect) {
    case 'fade':
      return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: null }
    case 'push':
      return {
        incoming: [{ transform: offBox(direction) }, { transform: IN_PLACE }],
        outgoing: [
          { transform: IN_PLACE },
          { transform: pushedOut(direction) },
        ],
      }
    case 'cover':
      return {
        incoming: [{ transform: offBox(direction) }, { transform: IN_PLACE }],
        outgoing: null,
      }
    case 'wipe':
      return {
        incoming: [{ clipPath: WIPED[direction] }, { clipPath: UNCUT }],
        outgoing: null,
      }
    case 'split':
      return {
        incoming: [
          {
            clipPath:
              direction === 'up' || direction === 'down'
                ? 'inset(50% 0% 50% 0%)'
                : 'inset(0% 50% 0% 50%)',
          },
          { clipPath: UNCUT },
        ],
        outgoing: null,
      }
    case 'zoom':
      return {
        incoming: [
          { transform: 'scale(0.3)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        outgoing: null,
      }
    case 'none':
      return null
  }
}
