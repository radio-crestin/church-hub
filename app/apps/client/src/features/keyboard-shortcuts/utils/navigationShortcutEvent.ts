/**
 * How a configured Next/Previous shortcut reaches the page on screen. The
 * shortcut manager catches the key from the desktop shell and raises this
 * event; the keyboard navigation provider hands it to whatever the open page
 * does with its own Next/Prev.
 */
const NAVIGATION_SHORTCUT_EVENT = 'navigation-shortcut'

export type NavigationDirection = 'next' | 'prev'

export interface NavigationShortcutDetail {
  direction: NavigationDirection
  /** The key as configured, e.g. "F2" or "PageDown". */
  shortcut: string
}

/** Raises the event; returns whether a listener took the shortcut. */
export function emitNavigationShortcut(
  direction: NavigationDirection,
  shortcut: string,
): boolean {
  const event = new CustomEvent<NavigationShortcutDetail>(
    NAVIGATION_SHORTCUT_EVENT,
    { detail: { direction, shortcut }, cancelable: true },
  )
  return !window.dispatchEvent(event)
}

/**
 * Listens for navigation shortcuts. `onShortcut` returns whether it took the
 * shortcut, which is what the emitter hears back. Returns the unsubscribe.
 */
export function listenForNavigationShortcuts(
  onShortcut: (detail: NavigationShortcutDetail) => boolean,
): () => void {
  const listener = (event: Event) => {
    const { detail } = event as CustomEvent<NavigationShortcutDetail>
    if (onShortcut(detail)) event.preventDefault()
  }
  window.addEventListener(NAVIGATION_SHORTCUT_EVENT, listener)
  return () => window.removeEventListener(NAVIGATION_SHORTCUT_EVENT, listener)
}
