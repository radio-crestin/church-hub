import { useEffect } from 'react'

interface UseSongKeyboardShortcutsOptions {
  onNextSlide: () => void
  onPreviousSlide: () => void
  onHidePresentation: () => void
  enabled?: boolean
}

export function useSongKeyboardShortcuts({
  onNextSlide,
  onPreviousSlide,
  onHidePresentation,
  enabled = true,
}: UseSongKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const isInInputField =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement

      // Escape should always work, even in input fields (to hide presentation)
      if (event.key === 'Escape') {
        event.preventDefault()
        // Blur the input field first if focused
        if (isInInputField && event.target instanceof HTMLElement) {
          event.target.blur()
        }
        onHidePresentation()
        return
      }

      // Skip other shortcuts if user is typing in an input field
      if (isInInputField) {
        return
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          onNextSlide()
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          onPreviousSlide()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, onNextSlide, onPreviousSlide, onHidePresentation])
}
