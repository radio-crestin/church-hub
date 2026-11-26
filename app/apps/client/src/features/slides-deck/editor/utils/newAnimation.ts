import type { DeckAnimation } from '../../types'
import { newDeckId } from '../../utils/newDeckId'

/** A new effect, as PowerPoint adds one: a Fade entrance on click. */
export function newAnimation(): DeckAnimation {
  return {
    id: newDeckId(),
    kind: 'entrance',
    effect: 'fade',
    trigger: 'click',
    delayMs: 0,
    durationMs: 500,
  }
}
