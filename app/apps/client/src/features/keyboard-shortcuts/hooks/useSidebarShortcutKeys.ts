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
 * This is how sidebar keys work by default, in the browser and in the desktop
 * app alike: only while Church Hub has the keyboard, so a program in front
 * keeps its own F-keys. With "page keys from any program" the desktop shell
 * holds them OS-wide instead (useGlobalAppShortcuts), which swallows the press
 * before the page sees it. Captured before any other handler so it works with
 * the focus inside a text field too, and so the browser never runs its own
 * meaning of the key (F6 moves focus to the address bar).
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
