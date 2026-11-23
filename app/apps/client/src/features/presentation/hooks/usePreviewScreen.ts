import { useMemo } from 'react'

import { useScreen } from './useScreen'
import { useScreens } from './useScreens'
import type { Screen, ScreenWithConfigs } from '../types'
import { resolvePreviewScreen } from '../utils/resolvePreviewScreen'

/**
 * Resolve the screen used for operator-side previews (LivePreview, the song
 * stage editor), as chosen in Settings > Screens or from the preview's own
 * picker (see resolvePreviewScreen for the fallback to the main screen).
 *
 * `screen` is the fully-loaded screen (with content configs), undefined while
 * loading; `previewScreen` is its entry in the list, known sooner.
 */
export function usePreviewScreen(): {
  screen: ScreenWithConfigs | undefined
  previewScreen: Screen | null
  isLoading: boolean
} {
  const { data: screens } = useScreens()

  const previewScreen = useMemo(() => resolvePreviewScreen(screens), [screens])

  const { data: screen, isLoading } = useScreen(previewScreen?.id ?? undefined)

  return { screen, previewScreen, isLoading }
}
