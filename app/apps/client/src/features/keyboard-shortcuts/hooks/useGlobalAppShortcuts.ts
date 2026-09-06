import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'
import { useIsAppFrontmost } from './useIsAppFrontmost'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../types'
import { isGlobalRecordingActive } from '../utils'

const logger = createLogger('app:keyboard:global')

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
  /**
   * Keys that pages bound to their own presentation actions. Registered once
   * each, however many pages share them; the handler gets the key and decides
   * what it means from the page that is open.
   */
  pageShortcuts?: string[]
  onStartLive: () => void
  onStopLive: () => void
  onShowSlide: () => void
  onNextSlide: () => void
  onPrevSlide: () => void
  onSceneSwitch: (sceneName: string) => void
  onSidebarNavigation: (route: string, focusSearch: boolean) => void
  onPageShortcut?: (shortcut: string) => void
  /** Ref to check if a ShortcutRecorder is currently recording */
  isRecordingRef?: React.RefObject<boolean>
  /** Whether any ShortcutRecorder is currently recording (reactive state) */
  isRecording?: boolean
}

export function useGlobalAppShortcuts({
  shortcuts,
  sceneShortcuts,
  sidebarShortcuts,
  pageShortcuts = [],
  onStartLive,
  onStopLive,
  onShowSlide,
  onNextSlide,
  onPrevSlide,
  onSceneSwitch,
  onSidebarNavigation,
  onPageShortcut,
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
    onPageShortcut,
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
      onPageShortcut,
    }
  }, [
    onStartLive,
    onStopLive,
    onShowSlide,
    onNextSlide,
    onPrevSlide,
    onSceneSwitch,
    onSidebarNavigation,
    onPageShortcut,
  ])

  // Navigation shortcuts are only held while Church Hub is the app in front —
  // see the registration loops below.
  const isFrontmost = useIsAppFrontmost()

  // Use JSON stringified config as dependency to avoid object reference issues
  const shortcutsJson = JSON.stringify(shortcuts)
  const sceneShortcutsJson = JSON.stringify(sceneShortcuts)
  const sidebarShortcutsJson = JSON.stringify(sidebarShortcuts)
  const pageShortcutsJson = JSON.stringify(pageShortcuts)

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
      const pageKeys: string[] = JSON.parse(pageShortcutsJson)

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

        // Register sidebar navigation shortcuts.
        //
        // These are held OS-wide, so while another application is in front they
        // would swallow the key there and then drag Church Hub over it — a bare
        // F6 would stop reaching the editor the user is typing in. They only
        // move around inside Church Hub, so they are worth nothing while the
        // user is elsewhere: register them only while the app is in front, and
        // hand the keys straight back to the other application otherwise.
        // Presentation and OBS shortcuts above stay global on purpose — running
        // the service from another window is exactly what they are for.
        for (const {
          shortcut,
          route,
          focusSearchOnNavigate,
          displayName,
        } of isFrontmost ? sidebarItems : []) {
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

        // Register page-scoped shortcuts: one registration per key, whatever
        // number of pages bound it. A key a global action already owns is
        // left to that action — the settings refuse such a conflict anyway.
        // Same frontmost rule as the sidebar shortcuts above: a page shortcut
        // opens a page inside Church Hub, so it has no meaning in another app.
        for (const shortcut of new Set(isFrontmost ? pageKeys : [])) {
          if (!shortcut || registeredShortcuts.has(shortcut)) continue
          if (isCancelled) return

          try {
            await register(shortcut, (event) => {
              if (event.state === 'Pressed') {
                if (isGlobalRecordingActive() || isRecordingRef?.current) {
                  logger.debug(
                    `Skipping page shortcut ${shortcut} - recording in progress`,
                  )
                  return
                }
                logger.info(`Page shortcut triggered: ${shortcut}`)
                handlersRef.current.onPageShortcut?.(shortcut)
              }
            })
            registeredShortcuts.add(shortcut)
            logger.info(`Registered page shortcut: ${shortcut}`)
          } catch (error) {
            logger.error(`Failed to register page shortcut ${shortcut}:`, error)
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
  }, [
    shortcutsJson,
    sceneShortcutsJson,
    sidebarShortcutsJson,
    pageShortcutsJson,
    isRecording,
    isFrontmost,
  ])
}
