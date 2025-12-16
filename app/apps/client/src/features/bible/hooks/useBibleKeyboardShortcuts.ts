import { useEffect } from 'react'

import type { BibleNavigationLevel } from './useBibleNavigation'

interface UseBibleKeyboardShortcutsOptions {
  level: BibleNavigationLevel
  verseIndex: number
  versesCount: number
  onNextVerse: () => void
  onPreviousVerse: () => void
  onNavigateDeeper: () => void
  onGoBack: () => void
  onHidePresentation: () => void
  onPresent: () => void
  enabled?: boolean
}

export function useBibleKeyboardShortcuts({
  level,
  verseIndex,
  versesCount,
  onNextVerse,
  onPreviousVerse,
  onNavigateDeeper,
  onGoBack,
  onHidePresentation,
  onPresent,
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
          event.preventDefault()
          if (level === 'verses' && verseIndex < versesCount - 1) {
            onNextVerse()
          }
          break

        case 'ArrowUp':
          event.preventDefault()
          if (level === 'verses' && verseIndex > 0) {
            onPreviousVerse()
          }
          break

        case 'ArrowRight':
        case 'Enter':
        case 'F5':
        case 'F10':
          event.preventDefault()
          if (level !== 'verses') {
            onNavigateDeeper()
          } else {
            onPresent()
          }
          break

        case 'ArrowLeft':
        case 'Backspace':
          event.preventDefault()
          onGoBack()
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
  }, [
    enabled,
    level,
    verseIndex,
    versesCount,
    onNextVerse,
    onPreviousVerse,
    onNavigateDeeper,
    onGoBack,
    onHidePresentation,
    onPresent,
  ])
}
