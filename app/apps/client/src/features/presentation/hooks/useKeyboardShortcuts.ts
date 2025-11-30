import { useEffect } from 'react'

import {
  useClearSlide,
  useNavigateSlide,
  usePresentationState,
  useStopPresentation,
} from './index'

export function useKeyboardShortcuts() {
  const { data: state } = usePresentationState()
  const navigateSlide = useNavigateSlide()
  const stopPresentation = useStopPresentation()
  const clearSlide = useClearSlide()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Only handle shortcuts when presenting
      if (!state?.isPresenting) return

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          event.preventDefault()
          navigateSlide.mutate({ direction: 'next' })
          break

        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          navigateSlide.mutate({ direction: 'prev' })
          break

        case 'Escape':
          event.preventDefault()
          stopPresentation.mutate()
          break

        case 'b':
        case 'B':
        case '.':
          // Black/blank screen
          event.preventDefault()
          clearSlide.mutate()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state?.isPresenting, navigateSlide, stopPresentation, clearSlide])
}
