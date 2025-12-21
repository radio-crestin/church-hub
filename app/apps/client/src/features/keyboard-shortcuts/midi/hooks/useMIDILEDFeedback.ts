import { useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../../types'
import { useMIDIOptional } from '../context'
import { getMIDIShortcutNoteNumber, isMIDIShortcut } from '../utils'

const logger = createLogger('midi:led-feedback')

interface SceneShortcut {
  shortcut: string
  sceneName: string
}

interface UseMIDILEDFeedbackOptions {
  shortcuts: GlobalShortcutsConfig
  sceneShortcuts: SceneShortcut[]
  isLive: boolean
  currentSceneName: string | null
}

/**
 * Hook to sync MIDI LED states with application state
 * - LEDs on for startLive/stopLive shortcuts when stream is live
 * - LEDs on for scene shortcuts matching current scene
 */
export function useMIDILEDFeedback({
  shortcuts,
  sceneShortcuts,
  isLive,
  currentSceneName,
}: UseMIDILEDFeedbackOptions) {
  const midi = useMIDIOptional()
  const previousLEDStatesRef = useRef<Map<number, boolean>>(new Map())

  useEffect(() => {
    if (!midi || !midi.isEnabled || !midi.selectedOutputId) {
      logger.debug('LED feedback disabled: no MIDI output')
      return
    }

    const newLEDStates = new Map<number, boolean>()

    // Process global action shortcuts
    if (shortcuts?.actions) {
      const actionIds = Object.keys(
        shortcuts.actions,
      ) as GlobalShortcutActionId[]

      for (const actionId of actionIds) {
        const config = shortcuts.actions[actionId]
        if (!config?.enabled || !config.shortcuts) continue

        for (const shortcut of config.shortcuts) {
          if (!isMIDIShortcut(shortcut)) continue

          const noteNumber = getMIDIShortcutNoteNumber(shortcut)
          if (noteNumber === null) continue

          // Determine LED state based on action type
          let shouldBeOn = false

          if (actionId === 'startLive' || actionId === 'stopLive') {
            // LED on when stream is live
            shouldBeOn = isLive
          }
          // For searchSong and searchBible, LEDs stay off (no persistent state)

          newLEDStates.set(noteNumber, shouldBeOn)
        }
      }
    }

    // Process scene shortcuts
    for (const { shortcut, sceneName } of sceneShortcuts) {
      if (!isMIDIShortcut(shortcut)) continue

      const noteNumber = getMIDIShortcutNoteNumber(shortcut)
      if (noteNumber === null) continue

      // LED on if this is the current scene
      const shouldBeOn = sceneName === currentSceneName

      newLEDStates.set(noteNumber, shouldBeOn)
    }

    // Compare with previous state and only send changes
    const changes: Array<{ note: number; on: boolean }> = []

    newLEDStates.forEach((on, note) => {
      if (previousLEDStatesRef.current.get(note) !== on) {
        changes.push({ note, on })
      }
    })

    // Also turn off LEDs that are no longer in the map
    previousLEDStatesRef.current.forEach((wasOn, note) => {
      if (!newLEDStates.has(note) && wasOn) {
        changes.push({ note, on: false })
      }
    })

    // Apply changes
    if (changes.length > 0) {
      logger.debug('LED state changes', { changes })
      for (const { note, on } of changes) {
        midi.setLED(note, on)
      }
    }

    // Update previous state
    previousLEDStatesRef.current = newLEDStates
  }, [midi, shortcuts, sceneShortcuts, isLive, currentSceneName])

  // Cleanup: turn off all LEDs when unmounting
  useEffect(() => {
    return () => {
      if (!midi || !midi.isEnabled) return

      logger.debug('Cleaning up LED states')
      previousLEDStatesRef.current.forEach((on, note) => {
        if (on) {
          midi.setLED(note, false)
        }
      })
    }
  }, [midi])
}
