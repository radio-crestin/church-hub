import { formatMIDIShortcutForDisplay, isMIDIShortcut } from '../midi/utils'
import type {
  GlobalShortcutActionId,
  GlobalShortcutsConfig,
  ShortcutConflict,
} from '../types'

export function formatShortcutForDisplay(shortcut: string): string {
  // Handle MIDI shortcuts
  if (isMIDIShortcut(shortcut)) {
    return formatMIDIShortcutForDisplay(shortcut)
  }

  // Handle keyboard shortcuts
  const isMac = navigator.platform.includes('Mac')

  return shortcut
    .replace('CommandOrControl', isMac ? 'Cmd' : 'Ctrl')
    .replace('Control', 'Ctrl')
    .replace('Meta', 'Cmd')
    .replace('Escape', 'Esc')
    .replace('ArrowUp', '\u2191')
    .replace('ArrowDown', '\u2193')
    .replace('ArrowLeft', '\u2190')
    .replace('ArrowRight', '\u2192')
}

export function isModifierKey(key: string): boolean {
  return ['Meta', 'Control', 'Alt', 'Shift'].includes(key)
}

export interface SceneShortcutSource {
  displayName: string
  shortcuts: string[]
}

// startLive and stopLive can share the same shortcut since they represent opposite states
const ALLOWED_SHARED_SHORTCUTS: [
  GlobalShortcutActionId,
  GlobalShortcutActionId,
][] = [['startLive', 'stopLive']]

function canShareShortcut(
  actionA: GlobalShortcutActionId,
  actionB: GlobalShortcutActionId,
): boolean {
  return ALLOWED_SHARED_SHORTCUTS.some(
    ([a, b]) =>
      (actionA === a && actionB === b) || (actionA === b && actionB === a),
  )
}

export function validateGlobalShortcut(
  shortcut: string,
  currentActionId: GlobalShortcutActionId,
  allGlobalShortcuts: GlobalShortcutsConfig,
  scenes: SceneShortcutSource[],
): ShortcutConflict | null {
  for (const [actionId, config] of Object.entries(allGlobalShortcuts.actions)) {
    if (actionId === currentActionId) continue
    // Allow startLive/stopLive to share the same shortcut
    if (canShareShortcut(currentActionId, actionId as GlobalShortcutActionId)) {
      continue
    }
    if (config.shortcuts.includes(shortcut)) {
      return {
        shortcut,
        conflictSource: 'global',
        conflictName: actionId,
      }
    }
  }

  for (const scene of scenes) {
    if (scene.shortcuts?.includes(shortcut)) {
      return {
        shortcut,
        conflictSource: 'scene',
        conflictName: scene.displayName,
      }
    }
  }

  return null
}

export function validateSceneShortcut(
  shortcut: string,
  currentSceneId: number | undefined,
  scenes: Array<{ id: number; displayName: string; shortcuts: string[] }>,
  globalShortcuts?: GlobalShortcutsConfig,
): ShortcutConflict | null {
  for (const scene of scenes) {
    if (scene.id === currentSceneId) continue
    if (scene.shortcuts?.includes(shortcut)) {
      return {
        shortcut,
        conflictSource: 'scene',
        conflictName: scene.displayName,
      }
    }
  }

  if (globalShortcuts) {
    for (const [actionId, config] of Object.entries(globalShortcuts.actions)) {
      if (config.shortcuts.includes(shortcut)) {
        return {
          shortcut,
          conflictSource: 'global',
          conflictName: actionId,
        }
      }
    }
  }

  return null
}
