import { useEffect } from 'react'

import {
  useClearSlide,
  useNavigateTemporary,
  usePresentationState,
  useShowSlide,
} from './index'

export function useKeyboardShortcuts() {
  const { data: state } = usePresentationState()
  const navigateTemporary = useNavigateTemporary()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()

  // Determine if we have content to navigate (song slides or temporary content)
  const hasNavigableContent =
    !!state?.currentSongSlideId || !!state?.temporaryContent

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

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          event.preventDefault()
          if (hasNavigableContent) {
            navigateTemporary.mutate({ direction: 'next' })
          }
          break

        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          if (hasNavigableContent) {
            navigateTemporary.mutate({ direction: 'prev' })
          }
          break

        case 'Escape':
          // Hide presentation (show clock)
          event.preventDefault()
          clearSlide.mutate()
          break

        case 'F5':
        case 'F10':
        case 'Enter':
          // Show presentation (unhide)
          event.preventDefault()
          showSlide.mutate()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasNavigableContent, navigateTemporary, clearSlide, showSlide])
}
