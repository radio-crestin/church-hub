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
      // Skip if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
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

        case 'Escape':
          event.preventDefault()
          onHidePresentation()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, onNextSlide, onPreviousSlide, onHidePresentation])
}
