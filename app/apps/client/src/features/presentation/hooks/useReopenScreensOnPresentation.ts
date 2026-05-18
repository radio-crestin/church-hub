import { useEffect, useRef } from 'react'

import { createLogger } from '../../../utils/logger'
import type { PresentationState } from '../types'
import {
  isTauri,
  reopenMissingActiveScreens,
} from '../utils/openDisplayWindow'
import { usePresentationState } from './usePresentationState'
import { useScreens } from './useScreens'

const logger = createLogger('app:screen')

function hasContent(state: PresentationState): boolean {
  return state.currentSongSlideId !== null || state.temporaryContent !== null
}

/**
 * Re-opens any active screen window the user manually closed (clicked X) the
 * next time content is presented. Screen rows keep `isActive: true` after a
 * manual close, so the WebSocket broadcast lands on a dead window — without
 * this hook, the user had to toggle the screen off/on in settings to recover.
 */
export function useReopenScreensOnPresentation(): void {
  const { data: screens } = useScreens()
  const { data: presentationState } = usePresentationState()
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (!isTauri() || !screens || !presentationState) return

    // Skip the first observation; useAutoOpenScreens handles initial startup.
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      return
    }

    if (!hasContent(presentationState)) return

    reopenMissingActiveScreens(screens).catch((error) => {
      logger.error(
        'Failed to reopen screen windows on presentation change:',
        error,
      )
    })
  }, [presentationState, screens])
}
