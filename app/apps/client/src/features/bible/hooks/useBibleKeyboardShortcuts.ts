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
  /** Whether at verses level (enables verse navigation with arrows) */
  isVersesLevel?: boolean
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
  isVersesLevel = false,
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

      // Backspace always works for navigation
      if (event.key === 'Backspace') {
        event.preventDefault()
        onGoBack()
        return true
      }

      // Verse-specific shortcuts only work at verses level
      if (!isVersesLevel) {
        return false
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
      isVersesLevel,
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
