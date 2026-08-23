import { useEffect, useRef } from 'react'

import { usePresentationState } from './usePresentationState'
import { useScreens } from './useScreens'
import { createLogger } from '../../../utils/logger'
import { closeDisplayWindow, isTauri } from '../utils/openDisplayWindow'

const logger = createLogger('app:screen')

/**
 * Closes Tauri windows for active screens whose `closeOnEscape` flag is
 * true whenever the presentation transitions to hidden (e.g. user pressed
 * Escape, used a hide button, or hit a MIDI shortcut). Hooks into the
 * state transition rather than a specific key handler so it works no
 * matter which UI path triggered the clear.
 *
 * Windows are auto-reopened on the next presentation via
 * useReopenScreensOnPresentation.
 */
export function useCloseScreensOnHide(): void {
  const { data: screens } = useScreens()
  const { data: presentationState } = usePresentationState()
  const prevHiddenRef = useRef<boolean | undefined>(undefined)
  // A transition seen before the screens list resolved is remembered rather
  // than dropped: the list loads asynchronously, and losing the transition left
  // the window open for the rest of the session.
  const pendingCloseRef = useRef(false)

  useEffect(() => {
    if (!isTauri() || !presentationState) return

    const wasHidden = prevHiddenRef.current
    const isHidden = presentationState.isHidden
    prevHiddenRef.current = isHidden

    // Only act on the false -> true transition. wasHidden must be explicitly
    // false (not undefined) so we don't fire when the app first loads with an
    // already-hidden state.
    if (wasHidden === false && isHidden) pendingCloseRef.current = true
    if (!pendingCloseRef.current || !screens) return
    pendingCloseRef.current = false

    const toClose = screens.filter((s) => s.isActive && s.closeOnEscape)
    if (toClose.length === 0) return

    Promise.all(toClose.map((s) => closeDisplayWindow(s.id))).catch((error) => {
      logger.error('Failed to close screen windows on hide:', error)
    })
  }, [presentationState, screens])
}
