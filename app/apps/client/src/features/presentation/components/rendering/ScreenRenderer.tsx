import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getApiUrl } from '~/config'
import { ScreenContent } from './ScreenContent'
import type { ContentData, NextSlideData } from './types'
import { usePresentationState, useWebSocket } from '../../hooks'
import { useScreen } from '../../hooks/useScreen'
import type { ContentType } from '../../types'
import { toggleWindowFullscreen } from '../../utils/fullscreen'
import { isTauri } from '../../utils/openDisplayWindow'

interface ScreenRendererProps {
  screenId: number
}

interface SongSlideData {
  id: number
  content: string
}

interface QueueItem {
  id: number
  itemType: string
  slideType?: string
  slideContent?: string
  bibleReference?: string
  bibleText?: string
  bibleTranslation?: string
  biblePassageVerses?: Array<{ id: number; reference: string; text: string }>
  biblePassageTranslation?: string
  verseteTineriEntries?: Array<{
    id: number
    reference: string
    text: string
    person?: string
  }>
  slides?: Array<{ id: number; content: string }>
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

  // Track container dimensions
  const [containerSize, setContainerSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  // Update container size on resize
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const updateSize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (containerRef.current) {
          const parent = containerRef.current.parentElement
          if (parent) {
            setContainerSize({
              width: parent.clientWidth,
              height: parent.clientHeight,
            })
            return
          }
        }
        // Fallback to window if no parent
        setContainerSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }, 100)
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateSize)
    }
  }, [])

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
          return
        }

        const queueResult = await queueResponse.json()
        const queueItems: QueueItem[] = queueResult.data || []

        // Find current content - song slide
        if (presentationState.currentSongSlideId) {
          for (const item of queueItems) {
            const slide = item.slides?.find(
              (s: SongSlideData) =>
                s.id === presentationState.currentSongSlideId,
            )
            if (slide) {
              setContentType('song')
              setContentData({
                mainText: slide.content,
              })

              // Find next slide for stage screen
              if (screen?.type === 'stage') {
                const slideIndex = item.slides?.findIndex(
                  (s: SongSlideData) =>
                    s.id === presentationState.currentSongSlideId,
                )
                if (
                  slideIndex !== undefined &&
                  slideIndex >= 0 &&
                  item.slides
                ) {
                  const nextSlide = item.slides[slideIndex + 1]
                  if (nextSlide) {
                    setNextSlideData({
                      contentType: 'song',
                      preview: nextSlide.content
                        .replace(/<[^>]*>/g, ' ')
                        .substring(0, 100),
                    })
                  } else {
                    setNextSlideData(undefined)
                  }
                }
              }
              return
            }
          }
        }

        if (
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
                  setContentType('versete_tineri')
                  setContentData({
                    personLabel: entry.person || '',
                    referenceText: entry.reference,
                    contentText: entry.text,
                  })
                  return
                }
              }

              setContentType('announcement')
              setContentData({
                mainText: queueItem.slideContent || '',
              })
              return
            }

            if (queueItem.itemType === 'bible') {
              const reference = (queueItem.bibleReference || '').replace(
                /\s*-\s*[A-Z]+\s*$/,
                '',
              )
              setContentType('bible')
              setContentData({
                referenceText: reference,
                contentText: queueItem.bibleText || '',
              })
              return
            }

            if (queueItem.itemType === 'bible_passage') {
              const verseId = presentationState.currentBiblePassageVerseId
              const verse = verseId
                ? queueItem.biblePassageVerses?.find((v) => v.id === verseId)
                : queueItem.biblePassageVerses?.[0]

              if (verse) {
                setContentType('bible_passage')
                setContentData({
                  referenceText: verse.reference,
                  contentText: verse.text,
                })

                if (screen?.type === 'stage' && queueItem.biblePassageVerses) {
                  const verseIndex = queueItem.biblePassageVerses.findIndex(
                    (v) => v.id === verse.id,
                  )
                  const nextVerse = queueItem.biblePassageVerses[verseIndex + 1]
                  if (nextVerse) {
                    setNextSlideData({
                      contentType: 'bible_passage',
                      preview: `${nextVerse.reference}: ${nextVerse.text.substring(0, 50)}...`,
                    })
                  } else {
                    setNextSlideData(undefined)
                  }
                }
                return
              }
            }
          }
        }

        setContentData(null)
        setContentType('empty')
        setNextSlideData(undefined)
      } catch (_error) {
        setContentData(null)
        setContentType('empty')
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

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen overflow-hidden cursor-default"
      onDoubleClick={toggleFullscreen}
    >
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
    </div>
  )
}
