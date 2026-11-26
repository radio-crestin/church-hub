import type { DeckAnimation, DeckTargetState } from '../types'

/**
 * How an effect leaves what it moves: an entrance shows it, an exit hides it,
 * Grow/Shrink keeps it 1.5 times as large and Transparency half see-through;
 * the others (Spin, Pulse) end where they started.
 */
export function stateAfterAnimation(
  state: DeckTargetState,
  animation: DeckAnimation,
): DeckTargetState {
  if (animation.kind === 'entrance') return { ...state, visible: true }
  if (animation.kind === 'exit') return { ...state, visible: false }
  if (animation.effect === 'grow_shrink') {
    return { ...state, scale: state.scale * 1.5 }
  }
  if (animation.effect === 'transparency') return { ...state, opacity: 0.5 }
  return state
}
