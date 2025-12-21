import { useCallback, useEffect, useRef } from 'react'

import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts'
import { useOBSScenes } from '../hooks/useOBSScenes'
import type { SceneShortcut } from '../types'

export function GlobalShortcutManager() {
  const { scenes, switchScene } = useOBSScenes()
  const previousShortcutsRef = useRef<string>('')

  const handleShortcutTriggered = useCallback(
    (sceneName: string) => {
      switchScene(sceneName)
    },
    [switchScene],
  )

  const { registerShortcuts } = useGlobalShortcuts({
    onShortcutTriggered: handleShortcutTriggered,
  })

  useEffect(() => {
    const shortcuts: SceneShortcut[] = []
    for (const scene of scenes) {
      if (scene.shortcuts) {
        for (const shortcut of scene.shortcuts) {
          shortcuts.push({ shortcut, sceneName: scene.obsSceneName })
        }
      }
    }

    const shortcutsKey = JSON.stringify(shortcuts)
    if (shortcutsKey !== previousShortcutsRef.current) {
      previousShortcutsRef.current = shortcutsKey
      registerShortcuts(shortcuts)
    }
  }, [scenes, registerShortcuts])

  return null
}
