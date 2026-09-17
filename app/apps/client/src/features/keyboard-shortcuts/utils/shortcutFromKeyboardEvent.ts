import { isModifierKey } from './shortcutValidation'

type KeyPress = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>

/**
 * A key press written the way shortcuts are stored in Settings → Shortcuts:
 * `CommandOrControl`, `Alt` and `Shift` in that order, then the key itself,
 * single characters upper-cased — "CommandOrControl+Shift+K", "PageDown".
 * Empty while only modifiers are held.
 */
export function shortcutFromKeyboardEvent(event: KeyPress): string {
  if (isModifierKey(event.key)) return ''

  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key)
  return parts.join('+')
}
