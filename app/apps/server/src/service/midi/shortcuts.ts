/**
 * Server-side MIDI shortcuts handler
 * Executes actions directly when MIDI messages are received
 * No client round-trip needed - actions are executed server-side
 */

import type { MIDIInputMessage } from './types'
import { getDatabase } from '../../db'
import { obsScenes } from '../../db/schema'
import { midiLogger } from '../../utils/fileLogger'
import { broadcastPresentationState } from '../../websocket'
import { switchScene } from '../livestream/obs/scenes'
import { startStreaming, stopStreaming } from '../livestream/obs/streaming'
import { navigateTemporary } from '../presentation/presentation-state'
import { getSetting } from '../settings'

// Action IDs that can be triggered via MIDI
type GlobalShortcutActionId =
  | 'startLive'
  | 'stopLive'
  | 'searchSong'
  | 'searchBible'
  | 'nextSlide'
  | 'prevSlide'

interface ShortcutActionConfig {
  shortcuts: string[]
  enabled: boolean
}

interface GlobalShortcutsConfig {
  actions: Record<GlobalShortcutActionId, ShortcutActionConfig>
  version: number
}

interface ShortcutMapping {
  type: 'global' | 'scene'
  action: string // ActionId or scene name
}

// In-memory cache of MIDI shortcut mappings
let shortcutMap = new Map<string, ShortcutMapping>()

// Debounce tracking to prevent duplicate triggers
const MIDI_DEBOUNCE_MS = 200
const lastTriggerTime = new Map<string, number>()

/**
 * Convert MIDI message to shortcut string format
 * Format: "midi:note_on:36" or "midi:cc:6"
 */
function midiMessageToShortcutString(msg: MIDIInputMessage): string {
  switch (msg.type) {
    case 'note_on':
      return `midi:note_on:${msg.note}`
    case 'note_off':
      return `midi:note_off:${msg.note}`
    case 'control_change':
      return `midi:cc:${msg.controller}`
    default:
      return ''
  }
}

/**
 * Check if a shortcut string is a MIDI shortcut
 */
function isMIDIShortcut(shortcut: string): boolean {
  return shortcut.startsWith('midi:')
}

/**
 * Load shortcuts configuration and build the lookup map
 * Call this on startup and when settings change
 */
export function loadMIDIShortcuts(): void {
  const newMap = new Map<string, ShortcutMapping>()

  // Load global shortcuts from settings
  try {
    const setting = getSetting('app_settings', 'global_keyboard_shortcuts')
    if (setting?.value) {
      const config = JSON.parse(setting.value) as GlobalShortcutsConfig

      if (config.actions) {
        for (const [actionId, actionConfig] of Object.entries(config.actions)) {
          if (actionConfig.enabled && actionConfig.shortcuts) {
            for (const shortcut of actionConfig.shortcuts) {
              if (isMIDIShortcut(shortcut)) {
                newMap.set(shortcut, { type: 'global', action: actionId })
                midiLogger.debug(
                  `Mapped MIDI shortcut ${shortcut} -> global:${actionId}`,
                )
              }
            }
          }
        }
      }
    }
  } catch (error) {
    midiLogger.error(`Failed to load global shortcuts: ${error}`)
  }

  // Load scene shortcuts from database
  try {
    const db = getDatabase()
    const scenes = db.select().from(obsScenes).all()

    for (const scene of scenes) {
      if (scene.shortcuts) {
        const shortcuts = JSON.parse(scene.shortcuts) as string[]
        for (const shortcut of shortcuts) {
          if (isMIDIShortcut(shortcut)) {
            newMap.set(shortcut, { type: 'scene', action: scene.obsSceneName })
            midiLogger.debug(
              `Mapped MIDI shortcut ${shortcut} -> scene:${scene.obsSceneName}`,
            )
          }
        }
      }
    }
  } catch (error) {
    midiLogger.error(`Failed to load scene shortcuts: ${error}`)
  }

  shortcutMap = newMap
  midiLogger.info(`Loaded ${newMap.size} MIDI shortcuts`)
}

/**
 * Execute an action by ID
 */
async function executeAction(actionId: GlobalShortcutActionId): Promise<void> {
  midiLogger.info(`Executing MIDI action: ${actionId}`)

  switch (actionId) {
    case 'nextSlide':
      try {
        const state = navigateTemporary('next', Date.now())
        broadcastPresentationState(state)
      } catch (error) {
        midiLogger.error(`Failed to navigate next: ${error}`)
      }
      break

    case 'prevSlide':
      try {
        const state = navigateTemporary('prev', Date.now())
        broadcastPresentationState(state)
      } catch (error) {
        midiLogger.error(`Failed to navigate prev: ${error}`)
      }
      break

    case 'startLive':
      try {
        await startStreaming()
      } catch (error) {
        midiLogger.error(`Failed to start streaming: ${error}`)
      }
      break

    case 'stopLive':
      try {
        await stopStreaming()
      } catch (error) {
        midiLogger.error(`Failed to stop streaming: ${error}`)
      }
      break

    case 'searchSong':
    case 'searchBible':
      // These are UI-only actions, cannot be executed server-side
      // The client will handle these based on the MIDI message broadcast
      midiLogger.debug(`Skipping UI-only action: ${actionId}`)
      break
  }
}

/**
 * Handle incoming MIDI message and execute mapped action
 * Returns true if an action was executed
 */
export async function handleMIDIShortcut(
  message: MIDIInputMessage,
): Promise<boolean> {
  // Only trigger on note_on or control_change with value > 0 (press, not release)
  if (message.type === 'note_off') return false
  if (message.type === 'control_change' && message.value === 0) return false

  const shortcutString = midiMessageToShortcutString(message)
  if (!shortcutString) return false

  // Debounce to prevent hardware double-triggers
  const now = Date.now()
  const lastTrigger = lastTriggerTime.get(shortcutString) || 0
  if (now - lastTrigger < MIDI_DEBOUNCE_MS) {
    midiLogger.debug(
      `Debouncing MIDI shortcut: ${shortcutString} (${now - lastTrigger}ms since last)`,
    )
    return false
  }
  lastTriggerTime.set(shortcutString, now)

  // Look up the action for this shortcut
  const mapping = shortcutMap.get(shortcutString)
  if (!mapping) {
    return false
  }

  midiLogger.info(
    `MIDI shortcut triggered: ${shortcutString} -> ${mapping.type}:${mapping.action}`,
  )

  if (mapping.type === 'global') {
    await executeAction(mapping.action as GlobalShortcutActionId)
    return true
  } else if (mapping.type === 'scene') {
    try {
      await switchScene(mapping.action)
      return true
    } catch (error) {
      midiLogger.error(`Failed to switch scene: ${error}`)
    }
  }

  return false
}

/**
 * Get the current number of mapped shortcuts (for debugging)
 */
export function getMIDIShortcutCount(): number {
  return shortcutMap.size
}
