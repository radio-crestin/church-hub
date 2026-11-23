import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { isGlobalRecordingActive } from '~/features/keyboard-shortcuts/utils/recordingState'
import { createLogger } from '~/utils/logger'
import type { HistoryStep } from '../types'
import { historyStepFromKey } from '../utils/historyStepFromKey'
import { historyStepFromMouse } from '../utils/historyStepFromMouse'

const logger = createLogger('history-navigation')

/**
 * Goes to the previous / next page on the mouse's side buttons and on Alt+←/→
 * (⌘[ / ⌘] on macOS), as a browser does. The desktop app's webviews leave
 * these to the page, so the app handles them itself, everywhere.
 *
 * Listens in the capture phase and stops the event, so a page's own arrow keys
 * (next slide, previous chapter) never also act on Alt+←. The default is
 * prevented too, so a browser that navigates by itself does not step twice.
 */
export function useHistoryNavigationInput() {
  const router = useRouter()

  useEffect(() => {
    const go = (step: HistoryStep, event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      logger.debug(`History ${step}`)
      if (step === 'back') router.history.back()
      else router.history.forward()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // A shortcut being recorded is the recorder's, Alt+← included.
      if (isGlobalRecordingActive()) return
      const step = historyStepFromKey(event)
      if (step) go(step, event)
    }

    // The side buttons' own browser action happens on mouseup: the press is
    // only kept from starting anything else.
    const handleMouseDown = (event: MouseEvent) => {
      if (historyStepFromMouse(event)) event.preventDefault()
    }

    const handleMouseUp = (event: MouseEvent) => {
      const step = historyStepFromMouse(event)
      if (step) go(step, event)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mouseup', handleMouseUp, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mouseup', handleMouseUp, true)
    }
  }, [router])
}
