import { useEffect } from 'react'

/**
 * Calls `onEscape` on Escape and keeps the key from reaching the page
 * (capture phase on window runs before the app's own Escape handlers, such
 * as "back to the song list" or "hide the projection").
 */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onEscape()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onEscape])
}
