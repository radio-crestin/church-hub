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

export {
  formatShortcutForDisplay,
  isModifierKey,
} from '~/features/keyboard-shortcuts'
