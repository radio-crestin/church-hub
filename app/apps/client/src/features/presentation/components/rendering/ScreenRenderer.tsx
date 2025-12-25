import { Maximize, Minimize } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getApiUrl } from '~/config'
import { ScreenContent } from './ScreenContent'
import type { ContentData, NextSlideData } from './types'
import { calculateNextSlideData, getBackgroundCSS } from './utils'
import { getNextVerse } from '../../../bible/service/bible'
import type { BibleVerse } from '../../../bible/types'
import type { QueueItem } from '../../../queue/types'
import type { SongSlide } from '../../../songs/types'
import {
  usePresentationState,
  useUpsertScreen,
  useWebSocket,
} from '../../hooks'
import { useScreen } from '../../hooks/useScreen'
import type { ContentType, PresentationState } from '../../types'
import { setWindowFullscreen } from '../../utils/fullscreen'
import { isTauri } from '../../utils/openDisplayWindow'

interface ScreenRendererProps {
  screenId: number
}

export function ScreenRenderer({ screenId }: ScreenRendererProps) {
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const { data: screen, isLoading, isError } = useScreen(screenId)
  const upsertScreen = useUpsertScreen()

  const containerRef = useRef<HTMLDivElement>(null)
  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [contentType, setContentType] = useState<ContentType>('empty')
  const [nextSlideData, setNextSlideData] = useState<
    NextSlideData | undefined
  >()

  // Fullscreen state and toolbar visibility
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showToolbar, setShowToolbar] = useState(false)
  const toolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userExitedFullscreenRef = useRef(false)

  // Track container dimensions (start at 0, render only when measured)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Use ResizeObserver to measure the wrapper element (NOT window size)
  // Re-run when screen loads to attach observer to the actual container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [screen])

  // Track fullscreen state and auto-switch to fullscreen on maximize
  useEffect(() => {
    let unlistenResize: (() => void) | null = null

    const setupTauriListeners = async () => {
      if (!isTauri()) return

      try {
        const { getCurrentWebviewWindow } = await import(
          '@tauri-apps/api/webviewWindow'
        )
        const win = getCurrentWebviewWindow()

        // Check initial fullscreen state
        const fs = await win.isFullscreen()
        setIsFullscreen(fs)

        // Listen for resize events to detect maximize
        unlistenResize = await win.listen('tauri://resize', async () => {
          const isMaximized = await win.isMaximized()
          const isFs = await win.isFullscreen()

          // If window is maximized but not fullscreen, switch to fullscreen
          // But only if user didn't just exit fullscreen manually
          if (isMaximized && !isFs && !userExitedFullscreenRef.current) {
            await setWindowFullscreen(win, true)
            setIsFullscreen(true)

            // Save to database
            if (screen) {
              upsertScreen.mutate({
                id: screen.id,
                name: screen.name,
                type: screen.type,
                isFullscreen: true,
              })
            }
          }

          // Reset the flag after a short delay to allow re-maximizing later
          if (!isMaximized && userExitedFullscreenRef.current) {
            setTimeout(() => {
              userExitedFullscreenRef.current = false
            }, 500)
          }

          setIsFullscreen(await win.isFullscreen())
        })
      } catch (_error) {}
    }

    const checkFullscreen = () => {
      if (!isTauri()) {
        // Cross-browser fullscreen element check
        const fullscreenElement =
          document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
          (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
        setIsFullscreen(!!fullscreenElement)
      }
    }

    setupTauriListeners()

    // Listen for fullscreen changes in browser (cross-browser support)
    document.addEventListener('fullscreenchange', checkFullscreen)
    document.addEventListener('webkitfullscreenchange', checkFullscreen)
    document.addEventListener('MSFullscreenChange', checkFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen)
      document.removeEventListener('webkitfullscreenchange', checkFullscreen)
      document.removeEventListener('MSFullscreenChange', checkFullscreen)
      if (unlistenResize) {
        unlistenResize()
      }
    }
  }, [screen, upsertScreen])

  // Helper function for browser fullscreen (cross-browser support)
  const useBrowserFullscreen = async (enterFullscreen: boolean): Promise<boolean> => {
    try {
      if (enterFullscreen) {
        const elem = document.documentElement
        if (elem.requestFullscreen) {
          await elem.requestFullscreen()
        } else if ((elem as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen()
        } else if ((elem as unknown as { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen) {
          await (elem as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen()
        }
      } else {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen()
          } else if ((document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
            await (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen()
          } else if ((document as unknown as { msExitFullscreen?: () => Promise<void> }).msExitFullscreen) {
            await (document as unknown as { msExitFullscreen: () => Promise<void> }).msExitFullscreen()
          }
        }
      }
      return true
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for fullscreen
      console.error('[useBrowserFullscreen] Error:', error)
      return false
    }
  }

  // Toggle fullscreen and save to database
  const toggleFullscreen = useCallback(async () => {
    const newFullscreen = !isFullscreen
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(`[toggleFullscreen] Toggling fullscreen to: ${newFullscreen}`)

    // If exiting fullscreen, set flag to prevent auto-fullscreen on resize
    if (!newFullscreen) {
      userExitedFullscreenRef.current = true
    }

    let success = false

    if (isTauri()) {
      try {
        const { getCurrentWebviewWindow } = await import(
          '@tauri-apps/api/webviewWindow'
        )
        const win = getCurrentWebviewWindow()
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
        console.log('[toggleFullscreen] Got window:', win?.label)

        // setWindowFullscreen now returns boolean indicating success
        const tauriSuccess = await setWindowFullscreen(win, newFullscreen)

        if (tauriSuccess) {
          setIsFullscreen(newFullscreen)
          success = true
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
          console.log('[toggleFullscreen] Tauri fullscreen set successfully')
        } else {
          // Tauri methods failed, try browser fullscreen as fallback
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
          console.log('[toggleFullscreen] Tauri methods failed, trying browser fullscreen fallback...')
          success = await useBrowserFullscreen(newFullscreen)
          if (success) {
            setIsFullscreen(newFullscreen)
            // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
            console.log('[toggleFullscreen] Browser fullscreen fallback succeeded')
          }
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
        console.error('[toggleFullscreen] Tauri fullscreen threw error, trying browser fallback:', error)
        // Fallback to browser fullscreen API when Tauri fails
        success = await useBrowserFullscreen(newFullscreen)
        if (success) {
          setIsFullscreen(newFullscreen)
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
          console.log('[toggleFullscreen] Browser fullscreen fallback succeeded after error')
        }
      }
    } else {
      // Not in Tauri, use browser fullscreen directly
      success = await useBrowserFullscreen(newFullscreen)
      if (success) {
        setIsFullscreen(newFullscreen)
      }
    }

    if (!success) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for fullscreen
      console.error('[toggleFullscreen] All fullscreen methods failed')
    }

    // Save fullscreen state to database
    if (screen) {
      upsertScreen.mutate({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        isFullscreen: newFullscreen,
      })
    }
  }, [isFullscreen, screen, upsertScreen])

  // Show toolbar on mouse move near the top
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const threshold = 60 // pixels from top
    if (e.clientY < threshold) {
      setShowToolbar(true)
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current)
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false)
      }, 3000)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current)
      }
    }
  }, [])

  // Make html and body transparent for screen display (allows user-configured backgrounds)
  useEffect(() => {
    const originalHtmlBg = document.documentElement.style.backgroundColor
    const originalBodyBg = document.body.style.backgroundColor

    document.documentElement.style.backgroundColor = 'transparent'
    document.body.style.backgroundColor = 'transparent'

    return () => {
      document.documentElement.style.backgroundColor = originalHtmlBg
      document.body.style.backgroundColor = originalBodyBg
    }
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFullscreen])

  // Clock tick for real-time updates (must be before any early returns)
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setClockTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch content based on presentation state
  useEffect(() => {
    const fetchContent = async () => {
      if (!presentationState) {
        setContentData(null)
        setContentType('empty')
        return
      }

      if (presentationState.isHidden) {
        setContentData(null)
        setContentType('empty')
        return
      }

      // Check for temporary content first (bypasses queue)
      if (presentationState.temporaryContent) {
        const temp = presentationState.temporaryContent

        if (temp.type === 'bible') {
          // Remove translation abbreviation from reference if present
          const reference = temp.data.reference.replace(/\s*-\s*[A-Z]+\s*$/, '')
          setContentType('bible')
          setContentData({
            referenceText: reference,
            contentText: temp.data.text,
          })
          setNextSlideData(undefined) // Temporary content doesn't have next slide preview
          return
        }

        if (temp.type === 'song') {
          const currentSlide = temp.data.slides[temp.data.currentSlideIndex]
          if (currentSlide) {
            setContentType('song')
            setContentData({ mainText: currentSlide.content })
            // For stage screens, show next slide preview
            if (screen?.type === 'stage') {
              const nextSlide =
                temp.data.slides[temp.data.currentSlideIndex + 1]
              if (nextSlide) {
                setNextSlideData({
                  contentType: 'song',
                  preview: nextSlide.content,
                })
              } else {
                setNextSlideData(undefined)
              }
            } else {
              setNextSlideData(undefined)
            }
            return
          }
        }
      }

      try {
        const queueResponse = await fetch(`${getApiUrl()}/api/queue`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          credentials: 'include',
        })

        if (!queueResponse.ok) {
          setContentData(null)
          setContentType('empty')
          setNextSlideData(undefined)
          return
        }

        const queueResult = await queueResponse.json()
        const queueItems: QueueItem[] = queueResult.data || []

        let foundContentType: ContentType = 'empty'
        let foundContentData: ContentData | null = null

        // Find current content - song slide
        if (presentationState.currentSongSlideId) {
          for (const item of queueItems) {
            const slide = item.slides?.find(
              (s: SongSlide) => s.id === presentationState.currentSongSlideId,
            )
            if (slide) {
              foundContentType = 'song'
              foundContentData = { mainText: slide.content }
              break
            }
          }
        }

        // If no song slide found, check other content types
        if (
          !foundContentData &&
          presentationState.currentQueueItemId &&
          !presentationState.currentSongSlideId
        ) {
          const queueItem = queueItems.find(
            (item) => item.id === presentationState.currentQueueItemId,
          )

          if (queueItem) {
            if (queueItem.itemType === 'slide') {
              if (
                queueItem.slideType === 'versete_tineri' &&
                queueItem.verseteTineriEntries
              ) {
                const entryId = presentationState.currentVerseteTineriEntryId
                const entry = entryId
                  ? queueItem.verseteTineriEntries.find((e) => e.id === entryId)
                  : queueItem.verseteTineriEntries[0]

                if (entry) {
                  foundContentType = 'versete_tineri'
                  foundContentData = {
                    personLabel: entry.personName || '',
                    referenceText: entry.reference,
                    contentText: entry.text,
                  }
                }
              }

              if (!foundContentData) {
                foundContentType = 'announcement'
                foundContentData = { mainText: queueItem.slideContent || '' }
              }
            } else if (queueItem.itemType === 'bible') {
              const reference = (queueItem.bibleReference || '').replace(
                /\s*-\s*[A-Z]+\s*$/,
                '',
              )
              foundContentType = 'bible'
              foundContentData = {
                referenceText: reference,
                contentText: queueItem.bibleText || '',
              }
            } else if (queueItem.itemType === 'bible_passage') {
              const verseId = presentationState.currentBiblePassageVerseId
              const verse = verseId
                ? queueItem.biblePassageVerses?.find((v) => v.id === verseId)
                : queueItem.biblePassageVerses?.[0]

              if (verse) {
                foundContentType = 'bible_passage'
                foundContentData = {
                  referenceText: verse.reference,
                  contentText: verse.text,
                }
              }
            }
          }
        }

        // Set content state
        setContentType(foundContentType)
        setContentData(foundContentData)

        // Calculate next slide for stage screens
        if (screen?.type === 'stage') {
          // Check if we need to fetch next Bible verse (when at end of Bible content with no next queue item)
          let nextBibleVerse: BibleVerse | null = null
          const currentItemIndex = queueItems.findIndex(
            (item) => item.id === presentationState.currentQueueItemId,
          )
          const hasNextQueueItem =
            currentItemIndex !== -1 && currentItemIndex < queueItems.length - 1
          const currentItem = queueItems[currentItemIndex]

          if (!hasNextQueueItem && currentItem) {
            let currentVerseId: number | null = null

            if (currentItem.itemType === 'bible') {
              // Single verse - always at "last slide"
              currentVerseId = currentItem.bibleVerseId
            } else if (currentItem.itemType === 'bible_passage') {
              // Bible passage - check if at last verse
              const verses = currentItem.biblePassageVerses || []
              const currentVerseIndex =
                presentationState.currentBiblePassageVerseId
                  ? verses.findIndex(
                      (v) =>
                        v.id === presentationState.currentBiblePassageVerseId,
                    )
                  : 0
              const isAtLastVerse = currentVerseIndex === verses.length - 1

              if (isAtLastVerse) {
                currentVerseId = verses[currentVerseIndex]?.verseId ?? null
              }
            }

            if (currentVerseId) {
              try {
                nextBibleVerse = await getNextVerse(currentVerseId)
              } catch {
                // Silently fail - no next verse preview
              }
            }
          }

          const nextSlide = calculateNextSlideData({
            queueItems,
            presentationState: presentationState as PresentationState,
            nextBibleVerse,
          })
          setNextSlideData(nextSlide)
        } else {
          setNextSlideData(undefined)
        }
      } catch (_error) {
        setContentData(null)
        setContentType('empty')
        setNextSlideData(undefined)
      }
    }

    fetchContent()
  }, [
    presentationState?.currentSongSlideId,
    presentationState?.currentQueueItemId,
    presentationState?.currentBiblePassageVerseId,
    presentationState?.currentVerseteTineriEntryId,
    presentationState?.isHidden,
    presentationState?.temporaryContent,
    presentationState?.updatedAt,
    screen?.type,
  ])

  if (isError) {
    return (
      <div
        className="w-screen h-screen"
        style={{ backgroundColor: 'black', background: 'transparent' }}
      />
    )
  }

  if (isLoading || !screen) {
    return (
      <div
        className="w-screen h-screen"
        style={{ backgroundColor: 'black', background: 'transparent' }}
      />
    )
  }

  const hasContent = contentData !== null
  const isVisible = hasContent && !presentationState?.isHidden

  // Get background from screen config for fullscreen display
  const config = screen.contentConfigs[contentType]
  const bg = config?.background || screen.contentConfigs.empty?.background

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen overflow-hidden cursor-default"
      style={bg ? getBackgroundCSS(bg) : { backgroundColor: '#000000' }}
      onDoubleClick={toggleFullscreen}
      onMouseMove={handleMouseMove}
    >
      {/* Floating toolbar */}
      <div
        className={`fixed top-0 right-0 z-50 p-2 transition-opacity duration-300 ${
          showToolbar ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onMouseEnter={() => {
          if (toolbarTimeoutRef.current) {
            clearTimeout(toolbarTimeoutRef.current)
          }
          setShowToolbar(true)
        }}
        onMouseLeave={() => {
          toolbarTimeoutRef.current = setTimeout(() => {
            setShowToolbar(false)
          }, 1000)
        }}
      >
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>

      {containerSize.width > 0 && containerSize.height > 0 && (
        <ScreenContent
          screen={screen}
          contentType={contentType}
          contentData={contentData}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          showClock={true}
          isVisible={isVisible}
          nextSlideData={nextSlideData}
          fillContainer={true}
        />
      )}
    </div>
  )
}
