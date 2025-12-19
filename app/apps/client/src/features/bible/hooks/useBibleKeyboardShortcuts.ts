import { useEffect } from 'react'

interface UseBibleKeyboardShortcutsOptions {
  onNextVerse: () => void
  onPreviousVerse: () => void
  onGoBack: () => void
  onHidePresentation: () => void
  onPresentSearched?: () => void
  enabled?: boolean
}

export function useBibleKeyboardShortcuts({
  onNextVerse,
  onPreviousVerse,
  onGoBack,
  onHidePresentation,
  onPresentSearched,
  enabled = true,
}: UseBibleKeyboardShortcutsOptions) {
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
          onNextVerse()
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          onPreviousVerse()
          break

        case 'Backspace':
          event.preventDefault()
          onGoBack()
          break

        case 'Escape':
          event.preventDefault()
          onHidePresentation()
          break

        case 'Enter':
          if (onPresentSearched) {
            event.preventDefault()
            onPresentSearched()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    enabled,
    onNextVerse,
    onPreviousVerse,
    onGoBack,
    onHidePresentation,
    onPresentSearched,
  ])
}
