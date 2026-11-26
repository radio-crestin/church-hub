import { type MouseEvent, useEffect, useRef } from 'react'

/** How long a first click waits for a second one before it counts alone. */
const DOUBLE_CLICK_WINDOW_MS = 250

/**
 * One click handler for a control where a click and a double-click do
 * different things: the click waits briefly so a double-click runs only its
 * own action. Keyboard activation (Enter, Space) runs the click at once.
 */
export function useClickOrDoubleClick(
  onClick: () => void,
  onDoubleClick: (() => void) | undefined,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }
  useEffect(() => cancel, [])

  return (event: MouseEvent) => {
    cancel()
    if (!onDoubleClick || event.detail === 0) return onClick()
    if (event.detail >= 2) return onDoubleClick()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      onClick()
    }, DOUBLE_CLICK_WINDOW_MS)
  }
}
