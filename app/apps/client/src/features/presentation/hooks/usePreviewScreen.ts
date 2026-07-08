import { useMemo } from 'react'

import { useScreen } from './useScreen'
import { useScreens } from './useScreens'
import type { ScreenWithConfigs } from '../types'

/**
 * Resolve the screen used for operator-side previews (LivePreview, the song
 * stage editor). Mirrors the projection the operator cares about:
 * 1. the screen explicitly flagged as the preview screen, if any
 * 2. otherwise the first primary screen, by sort order
 *
 * Returns the fully-loaded screen (with content configs) or null while loading.
 */
export function usePreviewScreen(): {
  screen: ScreenWithConfigs | undefined
  isLoading: boolean
} {
  const { data: screens } = useScreens()

  const previewScreen = useMemo(() => {
    if (!screens) return null
    const flagged = screens.find((s) => s.isPreviewScreen)
    if (flagged) return flagged
    return (
      screens
        .filter((s) => s.type === 'primary')
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] || null
    )
  }, [screens])

  const { data: screen, isLoading } = useScreen(previewScreen?.id ?? undefined)

  return { screen, isLoading }
}
