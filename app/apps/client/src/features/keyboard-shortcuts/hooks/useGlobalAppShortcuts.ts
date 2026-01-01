import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../types'

const logger = createLogger('keyboard-shortcuts:global')

// Check if we're running in Tauri mode
const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

interface SceneShortcut {
  shortcut: string
  sceneName: string
}

interface UseGlobalAppShortcutsOptions {
  shortcuts: GlobalShortcutsConfig
  sceneShortcuts: SceneShortcut[]
  onStartLive: () => void
  onStopLive: () => void
  onSearchSong: () => void
  onSearchBible: () => void
  onNextSlide: () => void
  onPrevSlide: () => void
  onSceneSwitch: (sceneName: string) => void
  /** Ref to check if a ShortcutRecorder is currently recording */
  isRecordingRef?: React.RefObject<boolean>
}

export function useGlobalAppShortcuts({
  shortcuts,
  sceneShortcuts,
  onStartLive,
  onStopLive,
  onSearchSong,
  onSearchBible,
  onNextSlide,
  onPrevSlide,
  onSceneSwitch,
  isRecordingRef,
}: UseGlobalAppShortcutsOptions) {
  // Use refs to always have current handlers without causing re-registration
  const handlersRef = useRef({
    onStartLive,
    onStopLive,
    onSearchSong,
    onSearchBible,
    onNextSlide,
    onPrevSlide,
    onSceneSwitch,
  })

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = {
      onStartLive,
      onStopLive,
      onSearchSong,
      onSearchBible,
      onNextSlide,
      onPrevSlide,
      onSceneSwitch,
    }
  }, [
    onStartLive,
    onStopLive,
    onSearchSong,
    onSearchBible,
    onNextSlide,
    onPrevSlide,
    onSceneSwitch,
  ])

  // Use JSON stringified config as dependency to avoid object reference issues
  const shortcutsJson = JSON.stringify(shortcuts)
  const sceneShortcutsJson = JSON.stringify(sceneShortcuts)

  useEffect(() => {
    // Skip if not running in Tauri (global shortcuts require Tauri)
    if (!isTauri) {
      logger.debug('Skipping global shortcuts - not running in Tauri')
      return
    }

    let isCancelled = false

    const registerAllShortcuts = async () => {
      const config: GlobalShortcutsConfig = JSON.parse(shortcutsJson)
      const scenes: SceneShortcut[] = JSON.parse(sceneShortcutsJson)

      try {
        // Unregister all existing shortcuts first
        await unregisterAll()
        logger.debug('Unregistered all previous shortcuts')

        if (isCancelled) return

        // Register global app shortcuts
        const actionHandlers: Record<GlobalShortcutActionId, () => void> = {
          startLive: () => handlersRef.current.onStartLive(),
          stopLive: () => handlersRef.current.onStopLive(),
          searchSong: () => handlersRef.current.onSearchSong(),
          searchBible: () => handlersRef.current.onSearchBible(),
          nextSlide: () => handlersRef.current.onNextSlide(),
          prevSlide: () => handlersRef.current.onPrevSlide(),
        }

        if (config.actions) {
          for (const [actionId, actionConfig] of Object.entries(
            config.actions,
          )) {
            if (!actionConfig.enabled) continue

            for (const shortcut of actionConfig.shortcuts) {
              if (!shortcut) continue
              if (isCancelled) return

              try {
                await register(shortcut, (event) => {
                  if (event.state === 'Pressed') {
                    // Skip if recording a new shortcut
                    if (isRecordingRef?.current) {
                      logger.debug(
                        `Skipping shortcut ${shortcut} - recording in progress`,
                      )
                      return
                    }
                    logger.info(
                      `App shortcut triggered: ${shortcut} -> ${actionId}`,
                    )
                    actionHandlers[actionId as GlobalShortcutActionId]()
                  }
                })
                logger.info(
                  `Registered app shortcut: ${shortcut} -> ${actionId}`,
                )
              } catch (error) {
                logger.error(
                  `Failed to register app shortcut ${shortcut}:`,
                  error,
                )
              }
            }
          }
        }

        // Register scene shortcuts
        for (const { shortcut, sceneName } of scenes) {
          if (!shortcut) continue
          if (isCancelled) return

          try {
            await register(shortcut, (event) => {
              if (event.state === 'Pressed') {
                // Skip if recording a new shortcut
                if (isRecordingRef?.current) {
                  logger.debug(
                    `Skipping scene shortcut ${shortcut} - recording in progress`,
                  )
                  return
                }
                logger.info(
                  `Scene shortcut triggered: ${shortcut} -> ${sceneName}`,
                )
                handlersRef.current.onSceneSwitch(sceneName)
              }
            })
            logger.info(
              `Registered scene shortcut: ${shortcut} -> ${sceneName}`,
            )
          } catch (error) {
            logger.error(
              `Failed to register scene shortcut ${shortcut}:`,
              error,
            )
          }
        }

        logger.info('All shortcuts registered successfully')
      } catch (error) {
        logger.error('Failed to register shortcuts:', error)
      }
    }

    registerAllShortcuts()

    return () => {
      isCancelled = true
      // Only attempt cleanup if Tauri is still available
      if (isTauri) {
        unregisterAll().catch((error) => {
          // Ignore errors during cleanup (common during HMR)
          logger.debug('Cleanup shortcuts skipped:', error)
        })
      }
    }
  }, [shortcutsJson, sceneShortcutsJson])
}
