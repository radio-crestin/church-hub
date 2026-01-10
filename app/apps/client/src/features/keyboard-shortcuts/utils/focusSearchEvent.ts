import { useEffect } from 'react'

/**
 * Custom event for triggering search input focus from keyboard shortcuts.
 * Used when already on the target route to avoid navigation and state changes.
 */

const FOCUS_SEARCH_EVENT = 'focus-search-input'

export function emitFocusSearchEvent(route: string) {
  window.dispatchEvent(
    new CustomEvent(FOCUS_SEARCH_EVENT, { detail: { route } }),
  )
}

export function useFocusSearchEvent(
  route: string,
  onFocus: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return

    const handleFocusEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ route: string }>
      // Match route with or without trailing slash
      const eventRoute = customEvent.detail.route.replace(/\/$/, '')
      const targetRoute = route.replace(/\/$/, '')
      if (eventRoute === targetRoute) {
        onFocus()
      }
    }

    window.addEventListener(FOCUS_SEARCH_EVENT, handleFocusEvent)
    return () => {
      window.removeEventListener(FOCUS_SEARCH_EVENT, handleFocusEvent)
    }
  }, [route, onFocus, enabled])
}
