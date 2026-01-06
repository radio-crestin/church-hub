import { useCallback } from 'react'

import {
  KEYBOARD_PRIORITY,
  useKeyboardNavigationHandler,
} from '~/features/keyboard-shortcuts'

interface UseSongSlideSelectionKeyboardOptions {
  slidesCount: number
  selectedSlideIndex: number
  onSelectSlide: (index: number) => void
  onPresentSlide: () => void
  onGoBack: () => void
  enabled?: boolean
}

/**
 * Keyboard navigation for song slide selection (when not presenting)
 * Registered at PAGE priority (higher than global presentation shortcuts)
 */
export function useSongSlideSelectionKeyboard({
  slidesCount,
  selectedSlideIndex,
  onSelectSlide,
  onPresentSlide,
  onGoBack,
  enabled = true,
}: UseSongSlideSelectionKeyboardOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          if (selectedSlideIndex < slidesCount - 1) {
            onSelectSlide(selectedSlideIndex + 1)
          }
          return true

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          if (selectedSlideIndex > 0) {
            onSelectSlide(selectedSlideIndex - 1)
          }
          return true

        case 'Enter':
          event.preventDefault()
          onPresentSlide()
          return true

        case 'Escape':
          event.preventDefault()
          onGoBack()
          return true

        default:
          return false
      }
    },
    [slidesCount, selectedSlideIndex, onSelectSlide, onPresentSlide, onGoBack],
  )

  // Register with PAGE priority (higher than global presentation shortcuts)
  useKeyboardNavigationHandler(
    'song-slide-selection',
    KEYBOARD_PRIORITY.PAGE,
    handleKeyDown,
    enabled && slidesCount > 0,
  )
}
