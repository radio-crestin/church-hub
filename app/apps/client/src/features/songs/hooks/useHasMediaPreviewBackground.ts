import { useMemo } from 'react'

import { usePreviewScreen } from '~/features/presentation/hooks/usePreviewScreen'
import type { ScreenBackgroundConfig } from '~/features/presentation/types'
import { hasMediaPreviewBackground } from '../utils/hasMediaPreviewBackground'

/**
 * Whether the song page's previews draw an image or a video behind this song's
 * lyrics (see `hasMediaPreviewBackground`). False while the preview screen is
 * still loading.
 */
export function useHasMediaPreviewBackground(
  songBackground: ScreenBackgroundConfig | null,
): boolean {
  const { screen } = usePreviewScreen()
  return useMemo(
    () => hasMediaPreviewBackground(screen, songBackground),
    [screen, songBackground],
  )
}
