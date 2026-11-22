import { isTypingTarget } from './isTypingTarget'
import type { HistoryStep } from '../types'

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * The history step a key press asks for, as browsers bind it: Alt+← / Alt+→,
 * and on macOS ⌘[ / ⌘] too. On macOS, Option+← in a text field moves the
 * caret by a word, so there it stays with the field. Null for any other key.
 */
export function historyStepFromKey(event: KeyboardEvent): HistoryStep | null {
  if (event.shiftKey || event.ctrlKey) return null
  if (event.altKey && !event.metaKey) {
    if (isMac() && isTypingTarget(event.target)) return null
    if (event.key === 'ArrowLeft') return 'back'
    if (event.key === 'ArrowRight') return 'forward'
  }
  if (isMac() && event.metaKey && !event.altKey) {
    if (event.key === '[') return 'back'
    if (event.key === ']') return 'forward'
  }
  return null
}
