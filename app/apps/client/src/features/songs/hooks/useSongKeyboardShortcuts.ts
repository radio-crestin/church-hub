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
  /** Registry id — override so two independent consumers (e.g. the classic
   * song page and the PowerPoint stage board) don't clobber each other. */
  id?: string
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
  id = 'song-presentation',
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
  useKeyboardNavigationHandler(id, KEYBOARD_PRIORITY.PAGE, handleKeyDown, enabled)
}
