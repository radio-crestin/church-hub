import { useCallback } from 'react'

import {
  KEYBOARD_PRIORITY,
  useKeyboardNavigationHandler,
} from '~/features/keyboard-shortcuts'
import {
  useClearSlide,
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
  const showSlide = useShowSlide()

  // Determine if we have content to navigate (song slides or temporary content)
  const hasNavigableContent =
    !!state?.currentSongSlideId || !!state?.temporaryContent

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
          // Hide presentation (show clock)
          event.preventDefault()
          clearSlide.mutate()
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
    [hasNavigableContent, navigateTemporary, clearSlide, showSlide],
  )

  // Register with PRESENTATION priority (lowest) - page-specific handlers take precedence
  useKeyboardNavigationHandler(
    'presentation-navigation',
    KEYBOARD_PRIORITY.PRESENTATION,
    handleKeyDown,
    true,
  )
}
