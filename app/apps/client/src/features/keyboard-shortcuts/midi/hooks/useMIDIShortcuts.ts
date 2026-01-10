import { useCallback, useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../../types'
import { useMIDIOptional } from '../context'
import { isMIDIShortcut, midiMessageToShortcutString } from '../utils'

const logger = createLogger('midi:shortcuts')

// Debounce time in milliseconds to prevent hardware double-triggers
const MIDI_DEBOUNCE_MS = 200

interface SceneShortcut {
  shortcut: string
  sceneName: string
}

interface UseMIDIShortcutsOptions {
  shortcuts: GlobalShortcutsConfig
  sceneShortcuts: SceneShortcut[]
  onStartLive?: () => void
  onStopLive?: () => void
  onShowSlide?: () => void
  onNextSlide?: () => void
  onPrevSlide?: () => void
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
  onShowSlide,
  onNextSlide,
  onPrevSlide,
  onSceneSwitch,
  isRecordingRef,
}: UseMIDIShortcutsOptions) {
  const midi = useMIDIOptional()

  // Use refs to avoid re-subscription on handler changes
  const handlersRef = useRef({
    onStartLive,
    onStopLive,
    onShowSlide,
    onNextSlide,
    onPrevSlide,
    onSceneSwitch,
  })

  useEffect(() => {
    handlersRef.current = {
      onStartLive,
      onStopLive,
      onShowSlide,
      onNextSlide,
      onPrevSlide,
      onSceneSwitch,
    }
  }, [
    onStartLive,
    onStopLive,
    onShowSlide,
    onNextSlide,
    onPrevSlide,
    onSceneSwitch,
  ])

  // Build a map of MIDI shortcuts to actions (supports multiple actions per shortcut)
  const shortcutMapRef = useRef<
    Map<string, Array<{ type: 'global' | 'scene'; action: string }>>
  >(new Map())

  // Track last trigger time per shortcut for debouncing
  const lastTriggerTimeRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const map = new Map<
      string,
      Array<{ type: 'global' | 'scene'; action: string }>
    >()

    // Helper to add a mapping, preventing duplicates
    const addMapping = (
      shortcut: string,
      type: 'global' | 'scene',
      action: string,
    ) => {
      const existing = map.get(shortcut) || []
      // Check for duplicates - same type and action
      const isDuplicate = existing.some(
        (m) => m.type === type && m.action === action,
      )
      if (!isDuplicate) {
        existing.push({ type, action })
        map.set(shortcut, existing)
        logger.debug(
          `Mapped MIDI shortcut ${shortcut} to ${type} action ${action}`,
        )
      } else {
        logger.debug(
          `Skipping duplicate mapping: ${shortcut} -> ${type} ${action}`,
        )
      }
    }

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
              addMapping(shortcut, 'global', actionId)
            }
          }
        }
      }
    }

    // Add scene shortcuts
    for (const { shortcut, sceneName } of sceneShortcuts) {
      if (isMIDIShortcut(shortcut)) {
        addMapping(shortcut, 'scene', sceneName)
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

      // Debounce: prevent hardware double-triggers
      const now = Date.now()
      const lastTrigger = lastTriggerTimeRef.current.get(shortcutString) || 0
      if (now - lastTrigger < MIDI_DEBOUNCE_MS) {
        logger.debug(
          `Debouncing MIDI shortcut: ${shortcutString} (${now - lastTrigger}ms since last)`,
        )
        return
      }
      lastTriggerTimeRef.current.set(shortcutString, now)

      const mappings = shortcutMapRef.current.get(shortcutString)

      if (!mappings || mappings.length === 0) return

      logger.info(`MIDI shortcut triggered: ${shortcutString}`, { mappings })

      // Check if this shortcut has both startLive and stopLive - use toggle behavior
      const hasStartLive = mappings.some(
        (m) => m.type === 'global' && m.action === 'startLive',
      )
      const hasStopLive = mappings.some(
        (m) => m.type === 'global' && m.action === 'stopLive',
      )
      const isSharedStartStop = hasStartLive && hasStopLive

      // Execute all mapped actions - handlers have state checks to determine which should run
      for (const mapping of mappings) {
        if (mapping.type === 'global') {
          switch (mapping.action as GlobalShortcutActionId) {
            case 'startLive':
              // startLive handler has toggle logic built-in
              handlersRef.current.onStartLive?.()
              break
            case 'stopLive':
              // Skip stopLive if shared with startLive - startLive handles toggle
              if (isSharedStartStop) {
                logger.debug(
                  'Skipping stopLive - shared shortcut handled by startLive toggle',
                )
                continue
              }
              handlersRef.current.onStopLive?.()
              break
            case 'showSlide':
              handlersRef.current.onShowSlide?.()
              break
            case 'nextSlide':
              handlersRef.current.onNextSlide?.()
              break
            case 'prevSlide':
              handlersRef.current.onPrevSlide?.()
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
    if (!midi || !midi.isEnabled) {
      return
    }
    const unsubscribe = midi.subscribe((message) => {
      handleMIDIMessage(message)
    })

    return () => {
      unsubscribe()
    }
  }, [midi, handleMIDIMessage])
}
