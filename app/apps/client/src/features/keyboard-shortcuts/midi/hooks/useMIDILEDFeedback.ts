import { useCallback, useEffect, useRef } from 'react'

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
 * - Automatically refreshes LEDs after MIDI events to override hardware toggle behavior
 */
export function useMIDILEDFeedback({
  shortcuts,
  sceneShortcuts,
  isLive,
  currentSceneName,
}: UseMIDILEDFeedbackOptions) {
  const midi = useMIDIOptional()
  const previousLEDStatesRef = useRef<Map<number, boolean>>(new Map())
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Force refresh all LEDs - re-sends current states to override hardware toggle
  const refreshLEDs = useCallback(() => {
    if (!midi || !midi.isEnabled || !midi.selectedOutputId) return

    // Re-send all current LED states to override hardware toggle
    previousLEDStatesRef.current.forEach((on, note) => {
      midi.setLED(note, on)
    })
    logger.debug('Refreshed all LED states after MIDI event')
  }, [midi])

  // Subscribe to all MIDI events and refresh LEDs after any event
  // This ensures our LED state overrides any hardware toggle behavior
  useEffect(() => {
    if (!midi || !midi.isEnabled) return

    const unsubscribe = midi.subscribe(() => {
      // Clear any pending refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }

      // Delay slightly to allow state to update, then force LED refresh
      refreshTimeoutRef.current = setTimeout(() => {
        refreshLEDs()
      }, 50) // 50ms delay allows state updates to propagate
    })

    return () => {
      unsubscribe()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [midi, refreshLEDs])

  // Subscribe to reconnection events to refresh LEDs after device reconnects
  useEffect(() => {
    if (!midi || !midi.isEnabled) return

    const unsubscribe = midi.subscribeToReconnection(() => {
      logger.info('MIDI device reconnected, refreshing all LED states')
      refreshLEDs()
    })

    return unsubscribe
  }, [midi, refreshLEDs])

  // Note: We intentionally do NOT turn off LEDs on unmount.
  // LED state should persist across page navigation. When the component
  // remounts, it will re-sync LED states based on current app state.
}
