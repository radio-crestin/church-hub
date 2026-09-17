import { useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useOBSScenes, useStreaming } from '~/features/livestream/hooks'
import {
  useNavigateTemporary,
  useShowSlide,
} from '~/features/presentation/hooks'
import {
  usePageShortcuts,
  useSidebarItemShortcuts,
} from '~/features/sidebar-config'
import { createLogger } from '~/utils/logger'
import { useShortcutRecording } from '../context'
import { useAppShortcuts, useGlobalAppShortcuts } from '../hooks'
import { useMIDILEDFeedback } from '../midi/hooks'
import { focusMainWindow } from '../utils/focusMainWindow'
import { emitFocusSearchEvent } from '../utils/focusSearchEvent'
import {
  emitNavigationShortcut,
  type NavigationDirection,
} from '../utils/navigationShortcutEvent'
import { emitPageShortcutEvent } from '../utils/pageShortcutEvent'
import { useGlobalRecordingState } from '../utils/recordingState'

const logger = createLogger('keyboard-shortcuts:manager')

export function GlobalAppShortcutManager() {
  const navigate = useNavigate()
  const location = useLocation()
  const { shortcuts, isLoading } = useAppShortcuts()
  const { start, stop, isLive, isStarting, isStopping, streamStartProgress } =
    useStreaming()
  const { scenes, switchScene, currentScene } = useOBSScenes()
  const { isRecordingRef } = useShortcutRecording()
  const isGlobalRecording = useGlobalRecordingState()
  const navigateTemporary = useNavigateTemporary()
  const showSlide = useShowSlide()
  const sidebarShortcuts = useSidebarItemShortcuts()
  const pageShortcuts = usePageShortcuts()
  const pageShortcutKeys = useMemo(
    () => pageShortcuts.map((entry) => entry.shortcut),
    [pageShortcuts],
  )

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

  // A Next/Previous shortcut does what the open page does with its own
  // Next/Prev: the song stage follows and saves its draft, a live program
  // keeps its place. Moving the projector directly was all it used to do, and
  // is now only what happens if nothing in the page takes the shortcut.
  const navigateByShortcut = useCallback(
    (direction: NavigationDirection, shortcut: string) => {
      if (emitNavigationShortcut(direction, shortcut)) return
      logger.debug(
        `Shortcut ${shortcut} (${direction}) not taken by the page; moving the projector`,
      )
      navigateTemporary.mutate({ direction })
    },
    [navigateTemporary],
  )

  const handleNextSlide = useCallback(
    (shortcut: string) => {
      logger.debug('Navigating to next slide via shortcut')
      navigateByShortcut('next', shortcut)
    },
    [navigateByShortcut],
  )

  const handlePrevSlide = useCallback(
    (shortcut: string) => {
      logger.debug('Navigating to previous slide via shortcut')
      navigateByShortcut('prev', shortcut)
    },
    [navigateByShortcut],
  )

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

      // Check if we're already on the target route (normalize trailing slashes)
      const currentPath = location.pathname.replace(/\/$/, '')
      const normalizedRoute = route.replace(/\/$/, '')
      const isAlreadyOnRoute = currentPath === normalizedRoute

      if (isAlreadyOnRoute && focusSearch) {
        // Already on the route - emit focus event instead of navigating
        // This avoids state changes and preserves the current input value
        emitFocusSearchEvent(route)
      } else if (focusSearch) {
        // Navigating to a different route with focus
        navigate({ to: route, search: { focus: true } })
      } else {
        navigate({ to: route })
      }
    },
    [navigate, location],
  )

  // A page-scoped key means whatever the OPEN page bound it to — and nothing
  // at all on any other page. So "F5" can show the selected slide on Songs
  // and the selected verse on Bible, and pressing it on Settings does nothing.
  const handlePageShortcut = useCallback(
    (shortcut: string) => {
      const currentPath = location.pathname.replace(/\/$/, '')
      const entry = pageShortcuts.find((candidate) => {
        if (candidate.shortcut !== shortcut) return false
        const route = candidate.route.replace(/\/$/, '')
        return currentPath === route || currentPath.startsWith(`${route}/`)
      })
      if (!entry) {
        logger.debug(
          `Page shortcut ${shortcut} ignored: no page bound to it is open (${location.pathname})`,
        )
        return
      }
      logger.debug(
        `Page shortcut ${shortcut} -> ${entry.pageId}.${entry.action}`,
      )
      if (entry.action === 'nextSlide') {
        navigateByShortcut('next', shortcut)
        return
      }
      if (entry.action === 'prevSlide') {
        navigateByShortcut('prev', shortcut)
        return
      }
      emitPageShortcutEvent(entry.pageId, entry.action)
    },
    [location.pathname, pageShortcuts, navigateByShortcut],
  )

  // Register keyboard shortcuts
  useGlobalAppShortcuts({
    shortcuts: isLoading ? { actions: {} as never, version: 1 } : shortcuts,
    sceneShortcuts,
    sidebarShortcuts,
    pageShortcuts: pageShortcutKeys,
    onStartLive: handleStartLive,
    onStopLive: handleStopLive,
    onShowSlide: handleShowSlide,
    onNextSlide: handleNextSlide,
    onPrevSlide: handlePrevSlide,
    onSceneSwitch: handleSceneSwitch,
    onSidebarNavigation: handleSidebarNavigation,
    onPageShortcut: handlePageShortcut,
    isRecordingRef,
    isRecording: isGlobalRecording,
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
