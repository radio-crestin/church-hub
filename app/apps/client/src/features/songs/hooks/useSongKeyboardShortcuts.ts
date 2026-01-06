import { useCallback } from 'react'

import {
  KEYBOARD_PRIORITY,
  useKeyboardNavigationHandler,
} from '~/features/keyboard-shortcuts'

interface UseSongKeyboardShortcutsOptions {
  onNextSlide: () => void
  onPreviousSlide: () => void
  onHidePresentation: () => void
  enabled?: boolean
}

/**
 * Keyboard shortcuts for song presentation navigation
 * Registered at PAGE priority (higher than global presentation shortcuts)
 */
export function useSongKeyboardShortcuts({
  onNextSlide,
  onPreviousSlide,
  onHidePresentation,
  enabled = true,
}: UseSongKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      // Escape should always work (even in input fields - handled by context)
      if (event.key === 'Escape') {
        event.preventDefault()
        // Blur the input field first if focused
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement
        ) {
          ;(event.target as HTMLElement).blur()
        }
        onHidePresentation()
        return true
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          onNextSlide()
          return true

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          onPreviousSlide()
          return true

        default:
          return false
      }
    },
    [onNextSlide, onPreviousSlide, onHidePresentation],
  )

  // Register with PAGE priority (higher than global presentation shortcuts)
  useKeyboardNavigationHandler(
    'song-presentation',
    KEYBOARD_PRIORITY.PAGE,
    handleKeyDown,
    enabled,
  )
}
