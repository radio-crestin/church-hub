import { useEffect } from 'react'

import {
  useClearSlide,
  useNavigateQueueSlide,
  useNavigateSlide,
  usePresentationState,
  useShowSlide,
  useStopPresentation,
} from './index'

export function useKeyboardShortcuts() {
  const { data: state } = usePresentationState()
  const navigateSlide = useNavigateSlide()
  const navigateQueueSlide = useNavigateQueueSlide()
  const stopPresentation = useStopPresentation()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()

  // Determine if we have queue slides to navigate
  const hasQueueSlide =
    !!state?.currentQueueItemId || !!state?.currentSongSlideId
  const canNavigate = state?.isPresenting || hasQueueSlide

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

      // Only handle navigation shortcuts when we can navigate
      if (!canNavigate) return

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          event.preventDefault()
          if (hasQueueSlide) {
            navigateQueueSlide.mutate('next')
          } else {
            navigateSlide.mutate({ direction: 'next' })
          }
          break

        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          if (hasQueueSlide) {
            navigateQueueSlide.mutate('prev')
          } else {
            navigateSlide.mutate({ direction: 'prev' })
          }
          break

        case 'Escape':
          event.preventDefault()
          stopPresentation.mutate()
          break

        case 'b':
        case 'B':
        case '.':
          // Black/blank screen - hide current slide
          event.preventDefault()
          clearSlide.mutate()
          break

        case 's':
        case 'S':
          // Show slide (restore from hidden)
          event.preventDefault()
          showSlide.mutate()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    canNavigate,
    hasQueueSlide,
    navigateSlide,
    navigateQueueSlide,
    stopPresentation,
    clearSlide,
    showSlide,
  ])
}
