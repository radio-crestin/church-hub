import { trackEvent } from './trackEvent'
import {
  describePressedElement,
  PRESSABLE_SELECTOR,
} from '../utils/describePressedElement'
import { describeShortcut } from '../utils/describeShortcut'

let installed = false

/**
 * One listener for the whole app: every press of a button, link, menu item,
 * tab or switch becomes a `button_pressed` event, every keyboard shortcut a
 * `shortcut_used` one. Capture phase, so presses whose handler stops the
 * event still count.
 */
export function installInteractionTracking(): void {
  if (installed) return
  installed = true

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null
      const pressed = target?.closest(PRESSABLE_SELECTOR)
      if (pressed) trackEvent('button_pressed', describePressedElement(pressed))
    },
    true,
  )

  document.addEventListener(
    'keydown',
    (event) => {
      const shortcut = describeShortcut(event)
      if (shortcut) trackEvent('shortcut_used', shortcut)
    },
    true,
  )
}
