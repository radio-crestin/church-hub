/**
 * How long apart the two arrivals of one key press can be. Both come from the
 * same physical press, so they land within a few milliseconds of each other;
 * the margin covers a busy page answering the second one late.
 */
export const NAVIGATION_ECHO_WINDOW_MS = 200

/** A key the navigation handlers acted on, and the route it arrived by. */
export interface HandledNavigationKey {
  /** The key as shortcuts are stored ("PageDown", "CommandOrControl+Right"). */
  shortcut: string
  /** A key press in the page, or a configured shortcut the shell caught. */
  source: 'keyboard' | 'shortcut'
  /** Milliseconds since the epoch. */
  at: number
}

/**
 * Whether a key is the second arrival of a press already acted on.
 *
 * A configured shortcut is held by the desktop shell OS-wide, and the shell
 * normally keeps the key from reaching the page. Where it lets the key through
 * as well, the same press would arrive twice — once as a page key, once as the
 * shortcut — and move two slides. That echo is the same key by the other route,
 * right after the first; a second press by the same route is a real one.
 */
export function isEchoedNavigationKey(
  previous: HandledNavigationKey | null,
  current: HandledNavigationKey,
): boolean {
  return (
    previous !== null &&
    previous.shortcut === current.shortcut &&
    previous.source !== current.source &&
    current.at - previous.at < NAVIGATION_ECHO_WINDOW_MS
  )
}
