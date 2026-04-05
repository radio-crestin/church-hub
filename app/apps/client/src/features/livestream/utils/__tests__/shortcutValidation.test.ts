import { describe, expect, it } from 'vitest'

import type { OBSScene } from '../../types'
import { validateShortcut } from '../shortcutValidation'

const makeScene = (
  id: number,
  displayName: string,
  shortcuts: string[],
): OBSScene => ({
  id,
  obsSceneName: displayName,
  displayName,
  isVisible: true,
  sortOrder: 0,
  shortcuts,
  contentTypes: [],
  mixerChannelActions: { mute: [], unmute: [] },
  isCurrent: false,
})

describe('livestream/utils/shortcutValidation', () => {
  describe('validateShortcut', () => {
    it('returns null when no conflict exists', () => {
      const scenes = [
        makeScene(1, 'Camera', ['F1']),
        makeScene(2, 'Screen', ['F2']),
      ]
      const result = validateShortcut('F3', 1, scenes)
      expect(result).toBeNull()
    })

    it('returns conflict when shortcut is used by another scene', () => {
      const scenes = [
        makeScene(1, 'Camera', ['F1']),
        makeScene(2, 'Screen', ['F2']),
      ]
      const result = validateShortcut('F2', 1, scenes)
      expect(result).toEqual({
        shortcut: 'F2',
        conflictingSceneName: 'Screen',
      })
    })

    it('does not conflict with the current scene', () => {
      const scenes = [
        makeScene(1, 'Camera', ['F1']),
        makeScene(2, 'Screen', ['F2']),
      ]
      const result = validateShortcut('F1', 1, scenes)
      expect(result).toBeNull()
    })

    it('handles undefined currentSceneId', () => {
      const scenes = [makeScene(1, 'Camera', ['F1'])]
      const result = validateShortcut('F1', undefined, scenes)
      expect(result).toEqual({
        shortcut: 'F1',
        conflictingSceneName: 'Camera',
      })
    })

    it('returns null for empty scenes array', () => {
      const result = validateShortcut('F1', 1, [])
      expect(result).toBeNull()
    })

    it('handles scenes with empty shortcuts', () => {
      const scenes = [makeScene(1, 'Camera', [])]
      const result = validateShortcut('F1', 2, scenes)
      expect(result).toBeNull()
    })

    it('finds conflict in scene with multiple shortcuts', () => {
      const scenes = [makeScene(1, 'Camera', ['F1', 'F2', 'F3'])]
      const result = validateShortcut('F2', 2, scenes)
      expect(result).toEqual({
        shortcut: 'F2',
        conflictingSceneName: 'Camera',
      })
    })
  })
})
