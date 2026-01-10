import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../types'

const logger = createLogger('keyboard-shortcuts:global')

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

interface SceneShortcut {
  shortcut: string
  sceneName: string
}

interface SidebarShortcut {
  shortcut: string
  itemId: string
  route: string
  focusSearchOnNavigate: boolean
  displayName: string
}

interface UseGlobalAppShortcutsOptions {
  shortcuts: GlobalShortcutsConfig
  sceneShortcuts: SceneShortcut[]
  sidebarShortcuts: SidebarShortcut[]
  onStartLive: () => void
  onStopLive: () => void
  onShowSlide: () => void
  onNextSlide: () => void
  onPrevSlide: () => void
  onSceneSwitch: (sceneName: string) => void
  onSidebarNavigation: (route: string, focusSearch: boolean) => void
  /** Ref to check if a ShortcutRecorder is currently recording */
  isRecordingRef?: React.RefObject<boolean>
}

export function useGlobalAppShortcuts({
  shortcuts,
  sceneShortcuts,
  sidebarShortcuts,
  onStartLive,
  onStopLive,
  onShowSlide,
  onNextSlide,
  onPrevSlide,
  onSceneSwitch,
  onSidebarNavigation,
  isRecordingRef,
}: UseGlobalAppShortcutsOptions) {
  // Use refs to always have current handlers without causing re-registration
  const handlersRef = useRef({
    onStartLive,
    onStopLive,
    onShowSlide,
    onNextSlide,
    onPrevSlide,
    onSceneSwitch,
    onSidebarNavigation,
  })

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = {
      onStartLive,
      onStopLive,
      onShowSlide,
      onNextSlide,
      onPrevSlide,
      onSceneSwitch,
      onSidebarNavigation,
    }
  }, [
    onStartLive,
    onStopLive,
    onShowSlide,
    onNextSlide,
    onPrevSlide,
    onSceneSwitch,
    onSidebarNavigation,
  ])

  // Use JSON stringified config as dependency to avoid object reference issues
  const shortcutsJson = JSON.stringify(shortcuts)
  const sceneShortcutsJson = JSON.stringify(sceneShortcuts)
  const sidebarShortcutsJson = JSON.stringify(sidebarShortcuts)

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
      const sidebarItems: SidebarShortcut[] = JSON.parse(sidebarShortcutsJson)

      try {
        // Unregister all existing shortcuts first
        await unregisterAll()
        logger.debug('Unregistered all previous shortcuts')

        if (isCancelled) return

        // Register global app shortcuts
        const actionHandlers: Record<GlobalShortcutActionId, () => void> = {
          startLive: () => handlersRef.current.onStartLive(),
          stopLive: () => handlersRef.current.onStopLive(),
          showSlide: () => handlersRef.current.onShowSlide(),
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

        // Register sidebar navigation shortcuts
        for (const {
          shortcut,
          route,
          focusSearchOnNavigate,
          displayName,
        } of sidebarItems) {
          if (!shortcut) continue
          if (isCancelled) return

          try {
            await register(shortcut, (event) => {
              if (event.state === 'Pressed') {
                // Skip if recording a new shortcut
                if (isRecordingRef?.current) {
                  logger.debug(
                    `Skipping sidebar shortcut ${shortcut} - recording in progress`,
                  )
                  return
                }
                logger.info(
                  `Sidebar shortcut triggered: ${shortcut} -> ${displayName} (${route})`,
                )
                handlersRef.current.onSidebarNavigation(
                  route,
                  focusSearchOnNavigate,
                )
              }
            })
            logger.info(
              `Registered sidebar shortcut: ${shortcut} -> ${displayName}`,
            )
          } catch (error) {
            logger.error(
              `Failed to register sidebar shortcut ${shortcut}:`,
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
  }, [shortcutsJson, sceneShortcutsJson, sidebarShortcutsJson])
}
