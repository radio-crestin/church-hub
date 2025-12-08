import { useEffect } from 'react'

import {
  useClearSlide,
  useNavigateQueueSlide,
  useNavigateSlide,
  usePresentationState,
  useShowSlide,
} from './index'

export function useKeyboardShortcuts() {
  const { data: state } = usePresentationState()
  const navigateSlide = useNavigateSlide()
  const navigateQueueSlide = useNavigateQueueSlide()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()

  // Determine if we have queue slides to navigate
  const hasQueueSlide =
    !!state?.currentQueueItemId || !!state?.currentSongSlideId
  const canNavigate = state?.isPresenting || hasQueueSlide

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or editor
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Don't trigger if user is in a contenteditable element (e.g., TipTap editor)
      if (
        event.target instanceof HTMLElement &&
        event.target.isContentEditable
      ) {
        return
      }

      // Don't trigger if any dialog/modal is open
      const openDialog = document.querySelector('dialog[open]')
      if (openDialog) {
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
          // Hide presentation (show clock)
          event.preventDefault()
          clearSlide.mutate()
          break

        case 'F5':
        case 'F10':
          // Show presentation (unhide)
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
    clearSlide,
    showSlide,
  ])
}
