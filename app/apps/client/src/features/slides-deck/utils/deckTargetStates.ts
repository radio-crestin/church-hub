import { deckTargetKey } from './deckTargetKey'
import { stateAfterAnimation } from './stateAfterAnimation'
import type { DeckClickGroup, DeckTargetState } from '../types'

export const RESTING_STATE: DeckTargetState = {
  visible: true,
  opacity: 1,
  scale: 1,
}

/**
 * How every animated part of a slide stands once its click groups up to
 * `buildIndex` have played (-1: before any). A part whose first effect is an
 * entrance waits hidden for it; parts without effects are not listed (they
 * rest as designed).
 */
export function deckTargetStates(
  groups: DeckClickGroup[],
  buildIndex: number,
): Map<string, DeckTargetState> {
  const states = new Map<string, DeckTargetState>()
  for (const { elementId, animation } of groups.flat()) {
    const key = deckTargetKey(elementId, animation.paragraphIndex)
    if (states.has(key)) continue
    states.set(key, {
      ...RESTING_STATE,
      visible: animation.kind !== 'entrance',
    })
  }
  for (const group of groups.slice(0, buildIndex + 1)) {
    for (const { elementId, animation } of group) {
      const key = deckTargetKey(elementId, animation.paragraphIndex)
      const state = states.get(key) ?? RESTING_STATE
      states.set(key, stateAfterAnimation(state, animation))
    }
  }
  return states
}
