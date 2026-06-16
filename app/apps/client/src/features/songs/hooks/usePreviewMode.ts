import { useCallback, useState } from 'react'

/**
 * Persisted "Preview mode" preference for the song detail stage.
 *
 * When ON, clicking a verse/chorus stages it in the operator's local stage
 * (LivePreview) WITHOUT projecting; the operator then projects it explicitly
 * (Afișează button or double-click). When OFF, a single click projects
 * immediately (the original behaviour).
 *
 * The choice is remembered globally across songs and app restarts.
 */
const STORAGE_KEY = 'song-detail:preview-mode'

function readStoredPreviewMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function usePreviewMode() {
  const [previewMode, setPreviewModeState] = useState<boolean>(
    readStoredPreviewMode,
  )

  const setPreviewMode = useCallback((next: boolean) => {
    setPreviewModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Ignore quota/availability errors — non-critical UI preference.
    }
  }, [])

  const togglePreviewMode = useCallback(() => {
    setPreviewModeState((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // Ignore quota/availability errors — non-critical UI preference.
      }
      return next
    })
  }, [])

  return { previewMode, setPreviewMode, togglePreviewMode }
}
