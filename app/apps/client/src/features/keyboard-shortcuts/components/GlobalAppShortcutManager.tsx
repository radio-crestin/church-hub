import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'

import { useOBSScenes, useStreaming } from '~/features/livestream/hooks'
import { createLogger } from '~/utils/logger'
import { useAppShortcuts, useGlobalAppShortcuts } from '../hooks'

const logger = createLogger('keyboard-shortcuts:manager')

export function GlobalAppShortcutManager() {
  const navigate = useNavigate()
  const { shortcuts, isLoading } = useAppShortcuts()
  const { start, stop } = useStreaming()
  const { scenes, switchScene } = useOBSScenes()

  // Build scene shortcuts array
  const sceneShortcuts = useMemo(() => {
    const result: Array<{ shortcut: string; sceneName: string }> = []
    for (const scene of scenes) {
      if (scene.shortcuts) {
        for (const shortcut of scene.shortcuts) {
          result.push({ shortcut, sceneName: scene.obsSceneName })
        }
      }
    }
    return result
  }, [scenes])

  const handleStartLive = useCallback(() => {
    logger.info('Starting live stream via shortcut')
    navigate({ to: '/livestream/' })
    start()
  }, [start, navigate])

  const handleStopLive = useCallback(() => {
    logger.info('Stopping live stream via shortcut')
    navigate({ to: '/livestream/' })
    stop()
  }, [stop, navigate])

  const handleSearchSong = useCallback(() => {
    logger.debug('Navigating to song search via shortcut')
    navigate({ to: '/songs/' })
  }, [navigate])

  const handleSearchBible = useCallback(() => {
    logger.debug('Navigating to Bible search via shortcut')
    navigate({ to: '/bible/' })
  }, [navigate])

  const handleSceneSwitch = useCallback(
    (sceneName: string) => {
      logger.debug(`Switching to scene: ${sceneName}`)
      switchScene(sceneName)
    },
    [switchScene],
  )

  useGlobalAppShortcuts({
    shortcuts: isLoading ? { actions: {} as never, version: 1 } : shortcuts,
    sceneShortcuts,
    onStartLive: handleStartLive,
    onStopLive: handleStopLive,
    onSearchSong: handleSearchSong,
    onSearchBible: handleSearchBible,
    onSceneSwitch: handleSceneSwitch,
  })

  return null
}
