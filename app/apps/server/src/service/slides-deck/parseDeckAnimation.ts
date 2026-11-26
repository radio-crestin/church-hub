import { deckReader } from './deckReader'
import {
  DECK_ANIMATION_EFFECTS,
  DECK_ANIMATION_KINDS,
  DECK_DIRECTIONS,
  DECK_TRIGGERS,
  type DeckAnimation,
} from './types'

/** Ten minutes: no effect or delay plays longer. */
const MAX_MS = 600_000

/** One animation of an element, checked field by field. */
export function parseDeckAnimation(
  value: unknown,
  path: string,
): DeckAnimation {
  const r = deckReader(value, path)
  return {
    id: r.id(),
    kind: r.oneOf('kind', DECK_ANIMATION_KINDS),
    effect: r.oneOf('effect', DECK_ANIMATION_EFFECTS),
    direction: r.optionalOneOf('direction', DECK_DIRECTIONS),
    trigger: r.oneOf('trigger', DECK_TRIGGERS),
    delayMs: r.number('delayMs', 0, MAX_MS),
    durationMs: r.number('durationMs', 0, MAX_MS),
    paragraphIndex: r.optionalNumber('paragraphIndex', 0, 10_000),
  }
}
