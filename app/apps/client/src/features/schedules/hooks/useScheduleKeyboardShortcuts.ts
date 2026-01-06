import { useCallback } from 'react'

import {
  KEYBOARD_PRIORITY,
  useKeyboardNavigationHandler,
} from '~/features/keyboard-shortcuts'

interface UseScheduleKeyboardShortcutsOptions {
  onNextSlide: () => void
  onPrevSlide: () => void
  onHidePresentation: () => void
  canNavigateNext: boolean
  canNavigatePrev: boolean
  enabled?: boolean
}

/**
 * Keyboard shortcuts for schedule presentation navigation
 * Registered at PAGE priority (higher than global presentation shortcuts)
 * This takes precedence over the default useKeyboardShortcuts which uses navigateTemporary
 * (only knows about current song, not schedule context)
 */
export function useScheduleKeyboardShortcuts({
  onNextSlide,
  onPrevSlide,
  onHidePresentation,
  canNavigateNext,
  canNavigatePrev,
  enabled = true,
}: UseScheduleKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          if (canNavigatePrev) {
            onPrevSlide()
          }
          return true

        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          event.preventDefault()
          if (canNavigateNext) {
            onNextSlide()
          }
          return true

        case 'Escape':
          event.preventDefault()
          onHidePresentation()
          return true

        default:
          return false
      }
    },
    [
      canNavigateNext,
      canNavigatePrev,
      onNextSlide,
      onPrevSlide,
      onHidePresentation,
    ],
  )

  // Register with PAGE priority (higher than global presentation shortcuts)
  useKeyboardNavigationHandler(
    'schedule-navigation',
    KEYBOARD_PRIORITY.PAGE,
    handleKeyDown,
    enabled,
  )
}
