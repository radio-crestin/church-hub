import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../types'
import { isGlobalRecordingActive } from '../utils'

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
  /** Whether any ShortcutRecorder is currently recording (reactive state) */
  isRecording?: boolean
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
  isRecording = false,
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

    // Skip registration during recording - this allows keys to reach the input field
    if (isRecording) {
      logger.debug(
        'Skipping shortcut registration - recording in progress, unregistering all',
      )
      unregisterAll().catch((error) => {
        logger.debug('Failed to unregister shortcuts during recording:', error)
      })
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

        // Track registered shortcuts to avoid duplicates
        // When startLive and stopLive share the same shortcut, use startLive handler (has toggle logic)
        const registeredShortcuts = new Set<string>()

        // Get startLive shortcuts to detect shared shortcuts with stopLive
        const startLiveShortcuts = new Set(
          config.actions?.startLive?.enabled
            ? config.actions.startLive.shortcuts
            : [],
        )

        if (config.actions) {
          for (const [actionId, actionConfig] of Object.entries(
            config.actions,
          )) {
            if (!actionConfig.enabled) continue

            for (const shortcut of actionConfig.shortcuts) {
              if (!shortcut) continue
              if (isCancelled) return

              // Skip if already registered (handles shared startLive/stopLive shortcuts)
              if (registeredShortcuts.has(shortcut)) {
                // For stopLive shortcuts that are also in startLive, startLive handles toggle
                if (
                  actionId === 'stopLive' &&
                  startLiveShortcuts.has(shortcut)
                ) {
                  logger.debug(
                    `Shortcut ${shortcut} shared with startLive - using toggle behavior`,
                  )
                }
                continue
              }

              // For stopLive-only shortcuts, still register them (for dedicated stop button)
              // For startLive shortcuts (including shared ones), use the toggle handler
              const effectiveHandler =
                actionId === 'stopLive' && startLiveShortcuts.has(shortcut)
                  ? actionHandlers.startLive // Use toggle handler for shared shortcuts
                  : actionHandlers[actionId as GlobalShortcutActionId]

              try {
                await register(shortcut, (event) => {
                  if (event.state === 'Pressed') {
                    // Skip if recording a new shortcut (check both global state and ref)
                    if (isGlobalRecordingActive() || isRecordingRef?.current) {
                      logger.debug(
                        `Skipping shortcut ${shortcut} - recording in progress`,
                      )
                      return
                    }
                    logger.info(
                      `App shortcut triggered: ${shortcut} -> ${actionId}`,
                    )
                    effectiveHandler()
                  }
                })
                registeredShortcuts.add(shortcut)
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
                // Skip if recording a new shortcut (check both global state and ref)
                if (isGlobalRecordingActive() || isRecordingRef?.current) {
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
                // Skip if recording a new shortcut (check both global state and ref)
                if (isGlobalRecordingActive() || isRecordingRef?.current) {
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
  }, [shortcutsJson, sceneShortcutsJson, sidebarShortcutsJson, isRecording])
}
