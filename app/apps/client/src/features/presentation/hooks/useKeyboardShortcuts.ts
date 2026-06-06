import { useCallback } from 'react'

import {
  KEYBOARD_PRIORITY,
  useKeyboardNavigationHandler,
} from '~/features/keyboard-shortcuts'
import {
  useClearSlide,
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  useShowSlide,
} from './index'

/**
 * Global keyboard shortcuts for presentation navigation
 * Registered at PRESENTATION priority (lowest) so page-specific handlers take precedence
 */
export function useKeyboardShortcuts() {
  const { data: state } = usePresentationState()
  const navigateTemporary = useNavigateTemporary()
  const clearSlide = useClearSlide()
  const clearTemporary = useClearTemporaryContent()
  const showSlide = useShowSlide()

  // Determine if we have content to navigate (song slides or temporary content)
  const hasTemporaryContent = !!state?.temporaryContent
  const hasNavigableContent = !!state?.currentSongSlideId || hasTemporaryContent

  // Full close for the presenter remote's "black screen" button: drop the
  // temporary content entirely (same end state as advancing past the last
  // slide) so the presentation truly CLOSES, not just blanks with a restore.
  const closePresentation = useCallback(() => {
    if (hasTemporaryContent) {
      clearTemporary.mutate()
    } else {
      clearSlide.mutate()
    }
  }, [hasTemporaryContent, clearTemporary, clearSlide])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          event.preventDefault()
          if (hasNavigableContent) {
            navigateTemporary.mutate({ direction: 'next' })
          }
          return true

        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          if (hasNavigableContent) {
            navigateTemporary.mutate({ direction: 'prev' })
          }
          return true

        case 'Escape':
          // Hide presentation (show clock). Window-close behavior for
          // screens without keepVisibleOnEscape is handled centrally in
          // useCloseScreensOnHide, which watches isHidden transitions and
          // works regardless of which Escape handler (global / song / bible
          // / schedules) actually triggers clearSlide.
          event.preventDefault()
          clearSlide.mutate()
          return true

        case 'b':
        case 'B':
        case '.':
          // A presenter remote's "black screen" button typically sends "b" or
          // ".". Fully CLOSE the live presentation (same end state as going
          // past the last slide). Only when something is live, so we never
          // swallow a stray keypress.
          if (!hasNavigableContent) return false
          event.preventDefault()
          closePresentation()
          return true

        case 'F5':
          // Presenter-remote "present/start" button. On the song page (higher
          // priority) this presents the focused slide; here we just swallow it
          // so the desktop webview never reloads on F5 elsewhere.
          event.preventDefault()
          return true

        case 'Enter':
          // Show presentation (unhide)
          event.preventDefault()
          showSlide.mutate()
          return true

        default:
          return false
      }
    },
    [
      hasNavigableContent,
      navigateTemporary,
      clearSlide,
      closePresentation,
      showSlide,
    ],
  )

  // Register with PRESENTATION priority (lowest) - page-specific handlers take precedence
  useKeyboardNavigationHandler(
    'presentation-navigation',
    KEYBOARD_PRIORITY.PRESENTATION,
    handleKeyDown,
    true,
  )
}
