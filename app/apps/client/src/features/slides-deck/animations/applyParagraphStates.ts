import { deckTransform } from './deckTransform'
import { findDeckTarget } from './findDeckTarget'
import type { DeckClickGroup, DeckTargetState } from '../types'
import { deckTargetKey } from '../utils/deckTargetKey'

/**
 * Leaves each paragraph a by-paragraph build moves as its effects left it
 * (`states`): paragraphs are the text's own HTML, so they are styled here
 * rather than by React.
 */
export function applyParagraphStates(
  root: HTMLElement,
  groups: DeckClickGroup[],
  states: Map<string, DeckTargetState>,
): void {
  for (const { elementId, animation } of groups.flat()) {
    const { paragraphIndex } = animation
    if (paragraphIndex == null) continue
    const node = findDeckTarget(root, elementId, paragraphIndex)
    const state = states.get(deckTargetKey(elementId, paragraphIndex))
    if (!node || !state) continue
    node.style.visibility = state.visible ? 'visible' : 'hidden'
    node.style.opacity = String(state.opacity)
    node.style.transform = deckTransform(0, 0, state.scale, 0)
  }
}
