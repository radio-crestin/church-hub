import type { DeckElement } from '../../types'
import { newDeckId } from '../../utils/newDeckId'

/** Copies of elements (and their animations) with ids of their own. */
export function withFreshIds(elements: DeckElement[]): DeckElement[] {
  return elements.map((element) => ({
    ...element,
    id: newDeckId(),
    animations: element.animations?.map((a) => ({ ...a, id: newDeckId() })),
  }))
}
