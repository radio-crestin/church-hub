import { shortcutFromKeyboardEvent } from '~/features/keyboard-shortcuts/utils/shortcutFromKeyboardEvent'
import { getCurrentFeature, getCurrentRoute } from './currentRoute'
import { PRESSABLE_SELECTOR } from './describePressedElement'
import type { ClientEventProperties } from '../analyticsEvents'

const NAMED_KEYS =
  /^(Escape|Enter|Delete|Backspace|Arrow(Up|Down|Left|Right)|Page(Up|Down)|Home|End|F\d{1,2}| )$/

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * The shortcut a key press is, or null when it is not one: plain letters
 * and digits, and anything typed into a text field, are never reported.
 */
export function describeShortcut(
  event: KeyboardEvent,
): ClientEventProperties<'shortcut_used'> | null {
  if (event.repeat || isTextField(event.target)) return null
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey
  if (!hasModifier && !NAMED_KEYS.test(event.key)) return null
  // Enter or Space on a focused button presses it: counted as that press.
  const pressesFocused =
    (event.key === 'Enter' || event.key === ' ') &&
    event.target instanceof Element &&
    event.target.closest(PRESSABLE_SELECTOR)
  if (pressesFocused) return null
  const shortcut = shortcutFromKeyboardEvent(event)
  if (!shortcut) return null
  return {
    shortcut: shortcut === ' ' ? 'Space' : shortcut,
    scope: 'app',
    feature: getCurrentFeature(),
    route: getCurrentRoute(),
  }
}
