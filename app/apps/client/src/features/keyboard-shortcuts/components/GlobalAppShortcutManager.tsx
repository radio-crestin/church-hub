import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useOBSScenes, useStreaming } from '~/features/livestream/hooks'
import {
  useNavigateTemporary,
  useShowSlide,
} from '~/features/presentation/hooks'
import { useSidebarItemShortcuts } from '~/features/sidebar-config'
import { createLogger } from '~/utils/logger'
import { useShortcutRecording } from '../context'
import { useAppShortcuts, useGlobalAppShortcuts } from '../hooks'
import { useMIDILEDFeedback } from '../midi/hooks'
import { focusMainWindow } from '../utils/focusMainWindow'

const logger = createLogger('keyboard-shortcuts:manager')

export function GlobalAppShortcutManager() {
  const navigate = useNavigate()
  const { shortcuts, isLoading } = useAppShortcuts()
  const { start, stop, isLive, isStarting, isStopping, streamStartProgress } =
    useStreaming()
  const { scenes, switchScene, currentScene } = useOBSScenes()
  const { isRecordingRef } = useShortcutRecording()
  const navigateTemporary = useNavigateTemporary()
  const showSlide = useShowSlide()
  const sidebarShortcuts = useSidebarItemShortcuts()

  // Synchronous guards to prevent multiple rapid triggers (React state can be stale)
  const isStartOperationRef = useRef(false)
  const isStopOperationRef = useRef(false)

  // Check if stream start is in progress (more reliable than just isStarting)
  const isStartingStream =
    streamStartProgress &&
    streamStartProgress.step !== 'completed' &&
    streamStartProgress.step !== 'error'

  // Reset start operation ref when operation completes
  useEffect(() => {
    if (!isStarting && !isStartingStream) {
      isStartOperationRef.current = false
    }
  }, [isStarting, isStartingStream])

  // Reset stop operation ref when operation completes
  useEffect(() => {
    if (!isStopping) {
      isStopOperationRef.current = false
    }
  }, [isStopping])

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
    // Toggle behavior: if already streaming, stop instead
    if (isLive) {
      if (isStopOperationRef.current || isStopping) {
        logger.debug('Skipping stop - already stopping')
        return
      }
      isStopOperationRef.current = true
      logger.info('Stopping live stream via shortcut (toggle)')
      navigate({ to: '/livestream' })
      stop()
      return
    }

    // Start stream
    if (isStartOperationRef.current || isStarting || isStartingStream) {
      logger.debug('Skipping start - already starting')
      return
    }
    isStartOperationRef.current = true
    logger.info('Starting live stream via shortcut')
    navigate({ to: '/livestream' })
    start()
  }, [start, stop, navigate, isLive, isStarting, isStopping, isStartingStream])

  const handleStopLive = useCallback(() => {
    // Allow stopping if live OR if currently starting (to cancel a start in progress)
    // Synchronous ref check works immediately (React state may be stale)
    if (
      isStopOperationRef.current ||
      (!isLive && !isStartingStream) ||
      isStopping
    ) {
      logger.debug(
        'Skipping stop - livestream is not live/starting or already stopping',
      )
      return
    }
    isStopOperationRef.current = true
    logger.info('Stopping live stream via shortcut')
    navigate({ to: '/livestream/' })
    stop()
  }, [stop, navigate, isLive, isStopping, isStartingStream])

  const handleShowSlide = useCallback(() => {
    logger.debug('Showing slide via shortcut')
    showSlide.mutate()
  }, [showSlide])

  const handleNextSlide = useCallback(() => {
    logger.debug('Navigating to next slide via shortcut')
    navigateTemporary.mutate({ direction: 'next' })
  }, [navigateTemporary])

  const handlePrevSlide = useCallback(() => {
    logger.debug('Navigating to previous slide via shortcut')
    navigateTemporary.mutate({ direction: 'prev' })
  }, [navigateTemporary])

  const handleSceneSwitch = useCallback(
    (sceneName: string) => {
      logger.debug(`Switching to scene: ${sceneName}`)
      switchScene(sceneName)
    },
    [switchScene],
  )

  const handleSidebarNavigation = useCallback(
    async (route: string, focusSearch: boolean) => {
      logger.debug(
        `Navigating to sidebar route: ${route}, focusSearch: ${focusSearch}`,
      )
      // Focus the main window first so input.focus() works when triggered from background
      await focusMainWindow()
      // Navigate with focus param if focusing search is enabled
      if (focusSearch) {
        navigate({ to: route, search: { focus: true } })
      } else {
        navigate({ to: route })
      }
    },
    [navigate],
  )

  // Register keyboard shortcuts
  useGlobalAppShortcuts({
    shortcuts: isLoading ? { actions: {} as never, version: 1 } : shortcuts,
    sceneShortcuts,
    sidebarShortcuts,
    onStartLive: handleStartLive,
    onStopLive: handleStopLive,
    onShowSlide: handleShowSlide,
    onNextSlide: handleNextSlide,
    onPrevSlide: handlePrevSlide,
    onSceneSwitch: handleSceneSwitch,
    onSidebarNavigation: handleSidebarNavigation,
    isRecordingRef,
  })

  // MIDI shortcuts are handled server-side for reliability
  // Only LED feedback is managed on the client
  // Sync MIDI LEDs with app state
  useMIDILEDFeedback({
    shortcuts: isLoading ? { actions: {} as never, version: 1 } : shortcuts,
    sceneShortcuts,
    isLive: isLive ?? false,
    currentSceneName: currentScene?.obsSceneName ?? null,
  })

  return null
}
