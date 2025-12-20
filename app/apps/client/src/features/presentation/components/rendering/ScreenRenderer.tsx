import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getApiUrl } from '~/config'
import { ScreenContent } from './ScreenContent'
import type { ContentData, NextSlideData } from './types'
import { calculateNextSlideData, getBackgroundCSS } from './utils'
import type { QueueItem } from '../../../queue/types'
import type { SongSlide } from '../../../songs/types'
import { usePresentationState, useWebSocket } from '../../hooks'
import { useScreen } from '../../hooks/useScreen'
import type { ContentType, PresentationState } from '../../types'
import { toggleWindowFullscreen } from '../../utils/fullscreen'
import { isTauri } from '../../utils/openDisplayWindow'

interface ScreenRendererProps {
  screenId: number
}

export function ScreenRenderer({ screenId }: ScreenRendererProps) {
  const { t } = useTranslation('presentation')
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const { data: screen, isLoading, isError } = useScreen(screenId)

  const containerRef = useRef<HTMLDivElement>(null)
  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [contentType, setContentType] = useState<ContentType>('empty')
  const [nextSlideData, setNextSlideData] = useState<
    NextSlideData | undefined
  >()

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

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (isTauri()) {
      try {
        const { getCurrentWebviewWindow } = await import(
          '@tauri-apps/api/webviewWindow'
        )
        const win = getCurrentWebviewWindow()
        await toggleWindowFullscreen(win)
      } catch (_error) {}
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
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
          const nextSlide = calculateNextSlideData({
            queueItems,
            presentationState: presentationState as PresentationState,
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
    presentationState?.updatedAt,
    screen?.type,
  ])

  if (isError) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-xl mb-2">{t('screens.renderer.error')}</div>
          <div className="text-gray-400 text-sm">
            {t('screens.renderer.notFound')}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading || !screen) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-white">{t('screens.renderer.loading')}</div>
      </div>
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
    >
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
        />
      )}
    </div>
  )
}
