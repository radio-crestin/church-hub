import { useCallback } from 'react'

import {
  KEYBOARD_PRIORITY,
  useKeyboardNavigationHandler,
} from '~/features/keyboard-shortcuts'

interface UseBibleKeyboardShortcutsOptions {
  onNextVerse: () => void
  onPreviousVerse: () => void
  onGoBack: () => void
  onHidePresentation: () => void
  onPresentSearched?: () => void
  enabled?: boolean
  /** Whether a verse is currently being presented (determines ESC behavior) */
  isPresenting?: boolean
}

/**
 * Keyboard shortcuts for bible navigation
 * Registered at PAGE priority (higher than global presentation shortcuts)
 */
export function useBibleKeyboardShortcuts({
  onNextVerse,
  onPreviousVerse,
  onGoBack,
  onHidePresentation,
  onPresentSearched,
  enabled = true,
  isPresenting = false,
}: UseBibleKeyboardShortcutsOptions) {
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
        // If presenting, hide the slide; otherwise go back
        if (isPresenting) {
          onHidePresentation()
        } else {
          onGoBack()
        }
        return true
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          onNextVerse()
          return true

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          onPreviousVerse()
          return true

        case 'Backspace':
          event.preventDefault()
          onGoBack()
          return true

        case 'Enter':
          if (onPresentSearched) {
            event.preventDefault()
            onPresentSearched()
            return true
          }
          return false

        default:
          return false
      }
    },
    [
      onNextVerse,
      onPreviousVerse,
      onGoBack,
      onHidePresentation,
      onPresentSearched,
      isPresenting,
    ],
  )

  // Register with PAGE priority (higher than global presentation shortcuts)
  useKeyboardNavigationHandler(
    'bible-navigation',
    KEYBOARD_PRIORITY.PAGE,
    handleKeyDown,
    enabled,
  )
}
