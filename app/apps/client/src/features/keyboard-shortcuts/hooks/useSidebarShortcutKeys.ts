import { useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import { canonicalShortcut } from '../utils/canonicalShortcut'
import { offerKeyToPage } from '../utils/pageKeyClaimEvent'
import { isGlobalRecordingActive } from '../utils/recordingState'
import { shortcutFromKeyboardEvent } from '../utils/shortcutFromKeyboardEvent'

const logger = createLogger('app:keyboard:sidebar-keys')

interface SidebarShortcutKey {
  shortcut: string
  route: string
  focusSearchOnNavigate: boolean
}

/**
 * Runs a sidebar shortcut (e.g. F6 = Bible + focus its search) when the page
 * itself receives the key press.
 *
 * The desktop shell registers these keys OS-wide, which swallows the press
 * before the page sees it. Wherever that registration is not in place — the
 * app opened in a browser, or the shell not holding the key at that moment —
 * the press reached the page, nothing handled it, and the browser ran its own
 * meaning instead (F6 moves focus to the address bar). Captured before any
 * other handler so it works with the focus inside a text field too, exactly
 * like the OS-wide registration does.
 */
export function useSidebarShortcutKeys(
  sidebarShortcuts: SidebarShortcutKey[],
  onSidebarNavigation: (route: string, focusSearch: boolean) => void,
) {
  const onNavigationRef = useRef(onSidebarNavigation)
  onNavigationRef.current = onSidebarNavigation

  useEffect(() => {
    const byKey = new Map(
      sidebarShortcuts
        .filter(({ shortcut }) => shortcut && !shortcut.startsWith('midi:'))
        .map((entry) => [canonicalShortcut(entry.shortcut), entry]),
    )
    if (byKey.size === 0) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const pressed = shortcutFromKeyboardEvent(event)
      if (!pressed) return
      const entry = byKey.get(canonicalShortcut(pressed))
      if (!entry || isGlobalRecordingActive()) return

      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      if (offerKeyToPage(pressed)) {
        logger.debug(`Sidebar key ${pressed} taken by the open page`)
        return
      }
      logger.debug(
        `Sidebar key ${pressed} pressed in the page -> ${entry.route}`,
      )
      onNavigationRef.current(entry.route, entry.focusSearchOnNavigate)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [sidebarShortcuts])
}
