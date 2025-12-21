import type { OBSScene } from '../types'

export interface ShortcutConflict {
  shortcut: string
  conflictingSceneName: string
}

export function validateShortcut(
  shortcut: string,
  currentSceneId: number | undefined,
  allScenes: OBSScene[],
): ShortcutConflict | null {
  for (const scene of allScenes) {
    if (scene.id === currentSceneId) continue
    if (scene.shortcuts?.includes(shortcut)) {
      return {
        shortcut,
        conflictingSceneName: scene.displayName,
      }
    }
  }
  return null
}

export function formatShortcutForDisplay(shortcut: string): string {
  const isMac = navigator.platform.includes('Mac')

  return shortcut
    .replace('CommandOrControl', isMac ? 'Cmd' : 'Ctrl')
    .replace('Control', 'Ctrl')
    .replace('Meta', 'Cmd')
    .replace('ArrowUp', '\u2191')
    .replace('ArrowDown', '\u2193')
    .replace('ArrowLeft', '\u2190')
    .replace('ArrowRight', '\u2192')
}

export function isModifierKey(key: string): boolean {
  return ['Meta', 'Control', 'Alt', 'Shift'].includes(key)
}
