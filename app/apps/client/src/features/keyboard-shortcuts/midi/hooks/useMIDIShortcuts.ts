import { useCallback, useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../../types'
import { useMIDIOptional } from '../context'
import { isMIDIShortcut, midiMessageToShortcutString } from '../utils'

const logger = createLogger('midi:shortcuts')

interface SceneShortcut {
  shortcut: string
  sceneName: string
}

interface UseMIDIShortcutsOptions {
  shortcuts: GlobalShortcutsConfig
  sceneShortcuts: SceneShortcut[]
  onStartLive?: () => void
  onStopLive?: () => void
  onSearchSong?: () => void
  onSearchBible?: () => void
  onSceneSwitch?: (sceneName: string) => void
  /** Ref to check if a ShortcutRecorder is currently recording */
  isRecordingRef?: React.RefObject<boolean>
}

/**
 * Hook to execute actions when MIDI messages match configured shortcuts
 */
export function useMIDIShortcuts({
  shortcuts,
  sceneShortcuts,
  onStartLive,
  onStopLive,
  onSearchSong,
  onSearchBible,
  onSceneSwitch,
  isRecordingRef,
}: UseMIDIShortcutsOptions) {
  const midi = useMIDIOptional()

  // Use refs to avoid re-subscription on handler changes
  const handlersRef = useRef({
    onStartLive,
    onStopLive,
    onSearchSong,
    onSearchBible,
    onSceneSwitch,
  })

  useEffect(() => {
    handlersRef.current = {
      onStartLive,
      onStopLive,
      onSearchSong,
      onSearchBible,
      onSceneSwitch,
    }
  }, [onStartLive, onStopLive, onSearchSong, onSearchBible, onSceneSwitch])

  // Build a map of MIDI shortcuts to actions (supports multiple actions per shortcut)
  const shortcutMapRef = useRef<
    Map<string, Array<{ type: 'global' | 'scene'; action: string }>>
  >(new Map())

  useEffect(() => {
    const map = new Map<
      string,
      Array<{ type: 'global' | 'scene'; action: string }>
    >()

    // Add global action shortcuts
    if (shortcuts?.actions) {
      const actionIds = Object.keys(
        shortcuts.actions,
      ) as GlobalShortcutActionId[]
      for (const actionId of actionIds) {
        const config = shortcuts.actions[actionId]
        if (config?.enabled && config.shortcuts) {
          for (const shortcut of config.shortcuts) {
            if (isMIDIShortcut(shortcut)) {
              const existing = map.get(shortcut) || []
              existing.push({ type: 'global', action: actionId })
              map.set(shortcut, existing)
              logger.debug(
                `Mapped MIDI shortcut ${shortcut} to global action ${actionId}`,
              )
            }
          }
        }
      }
    }

    // Add scene shortcuts
    for (const { shortcut, sceneName } of sceneShortcuts) {
      if (isMIDIShortcut(shortcut)) {
        const existing = map.get(shortcut) || []
        existing.push({ type: 'scene', action: sceneName })
        map.set(shortcut, existing)
        logger.debug(`Mapped MIDI shortcut ${shortcut} to scene ${sceneName}`)
      }
    }

    shortcutMapRef.current = map
    logger.info(`Built MIDI shortcut map with ${map.size} entries`)
  }, [shortcuts, sceneShortcuts])

  // Handle incoming MIDI messages
  const handleMIDIMessage = useCallback(
    (message: {
      type: string
      note?: number
      controller?: number
      value: number
    }) => {
      // Skip if recording a new shortcut
      if (isRecordingRef?.current) {
        logger.debug('Skipping MIDI action - recording in progress')
        return
      }

      // Only trigger on note_on or control_change with value > 0 (press, not release)
      if (message.type === 'note_off') return
      if (message.type === 'control_change' && message.value === 0) return

      const shortcutString = midiMessageToShortcutString(message as never)
      const mappings = shortcutMapRef.current.get(shortcutString)

      if (!mappings || mappings.length === 0) return

      logger.info(`MIDI shortcut triggered: ${shortcutString}`, { mappings })

      // Execute all mapped actions - handlers have state checks to determine which should run
      for (const mapping of mappings) {
        if (mapping.type === 'global') {
          switch (mapping.action as GlobalShortcutActionId) {
            case 'startLive':
              handlersRef.current.onStartLive?.()
              break
            case 'stopLive':
              handlersRef.current.onStopLive?.()
              break
            case 'searchSong':
              handlersRef.current.onSearchSong?.()
              break
            case 'searchBible':
              handlersRef.current.onSearchBible?.()
              break
          }
        } else if (mapping.type === 'scene') {
          handlersRef.current.onSceneSwitch?.(mapping.action)
        }
      }
    },
    // Note: isRecordingRef is intentionally not in deps - it's a stable ref and we read .current at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Subscribe to MIDI messages
  useEffect(() => {
    console.log('[useMIDIShortcuts] Effect triggered:', {
      hasMidi: !!midi,
      isEnabled: midi?.isEnabled,
    })

    if (!midi || !midi.isEnabled) {
      console.log(
        '[useMIDIShortcuts] Not subscribing - midi:',
        !!midi,
        'isEnabled:',
        midi?.isEnabled,
      )
      return
    }

    console.log('[useMIDIShortcuts] Subscribing to MIDI messages')
    const unsubscribe = midi.subscribe((message) => {
      console.log('[useMIDIShortcuts] MIDI message received:', message)
      handleMIDIMessage(message)
    })

    return () => {
      console.log('[useMIDIShortcuts] Unsubscribing from MIDI messages')
      unsubscribe()
    }
  }, [midi, handleMIDIMessage])
}
