import { useCallback, useEffect, useState } from 'react'

import { getApiUrl } from '~/config'
import { TextElement } from './TextElement'
import { getBackgroundCSS, getTextStyleCSS, toPixels } from './utils/styleUtils'
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

interface ContentData {
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
}

interface NextSlideData {
  contentType: ContentType
  preview: string
}

export function ScreenRenderer({ screenId }: ScreenRendererProps) {
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const { data: screen } = useScreen(screenId)

  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [contentType, setContentType] = useState<ContentType>('empty')
  const [nextSlideData, setNextSlideData] = useState<
    NextSlideData | undefined
  >()

  // Track viewport dimensions
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  // Debounced resize handler
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
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

  if (!screen) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading screen configuration...</div>
      </div>
    )
  }

  // Calculate scale (viewport relative to screen config)
  const scale = viewportSize.width / screen.width
  const canvasWidth = screen.width
  const canvasHeight = screen.height

  const config = screen.contentConfigs[contentType]
  const backgroundConfig =
    config?.background || screen.contentConfigs.empty?.background

  const hasContent = contentData !== null
  const isVisible = hasContent && !presentationState?.isHidden

  // Render main text
  const renderMainText = () => {
    if (!config || !('mainText' in config) || !contentData?.mainText)
      return null

    // Force autoScale for display rendering
    const configWithAutoScale = {
      ...config.mainText,
      style: { ...config.mainText.style, autoScale: true },
    }

    return (
      <TextElement
        key="mainText"
        config={configWithAutoScale}
        content={contentData.mainText}
        screenWidth={viewportSize.width}
        screenHeight={viewportSize.height}
        isVisible={true}
        isHtml={true}
      />
    )
  }

  // Render content text
  const renderContentText = () => {
    if (!config || !('contentText' in config) || !contentData?.contentText)
      return null

    // Force autoScale for display rendering
    const configWithAutoScale = {
      ...config.contentText,
      style: { ...config.contentText.style, autoScale: true },
    }

    return (
      <TextElement
        key="contentText"
        config={configWithAutoScale}
        content={contentData.contentText}
        screenWidth={viewportSize.width}
        screenHeight={viewportSize.height}
        isVisible={true}
        isHtml={false}
      />
    )
  }

  // Render reference text
  const renderReferenceText = () => {
    if (!config || !('referenceText' in config) || !contentData?.referenceText)
      return null

    // Force autoScale for display rendering
    const configWithAutoScale = {
      ...config.referenceText,
      style: { ...config.referenceText.style, autoScale: true },
    }

    return (
      <TextElement
        key="referenceText"
        config={configWithAutoScale}
        content={contentData.referenceText}
        screenWidth={viewportSize.width}
        screenHeight={viewportSize.height}
        isVisible={true}
        isHtml={false}
      />
    )
  }

  // Render person label
  const renderPersonLabel = () => {
    if (!config || !('personLabel' in config) || !contentData?.personLabel)
      return null

    // Force autoScale for display rendering
    const configWithAutoScale = {
      ...config.personLabel,
      style: { ...config.personLabel.style, autoScale: true },
    }

    return (
      <TextElement
        key="personLabel"
        config={configWithAutoScale}
        content={contentData.personLabel}
        screenWidth={viewportSize.width}
        screenHeight={viewportSize.height}
        isVisible={true}
        isHtml={false}
      />
    )
  }

  // Render clock
  const renderClock = () => {
    const clockConfig =
      config && 'clock' in config
        ? config.clock
        : screen.contentConfigs.empty?.clock
    if (!clockConfig?.enabled) return null

    const x =
      toPixels(clockConfig.position.x, clockConfig.position.unit, canvasWidth) *
      scale
    const y =
      toPixels(
        clockConfig.position.y,
        clockConfig.position.unit,
        canvasHeight,
      ) * scale

    const now = new Date()
    const timeString = clockConfig.showSeconds
      ? now.toLocaleTimeString('ro-RO', { hour12: false })
      : now.toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

    return (
      <div
        key="clock"
        className="absolute overflow-hidden flex items-center justify-end"
        style={{
          right: canvasWidth * scale - x,
          top: y,
          ...getTextStyleCSS(clockConfig.style),
          fontSize: clockConfig.style.maxFontSize * scale,
        }}
      >
        {timeString}
      </div>
    )
  }

  // Render next slide section (stage screens)
  const renderNextSlideSection = () => {
    if (screen.type !== 'stage' || !screen.nextSlideConfig?.enabled) return null
    const ns = screen.nextSlideConfig
    const x = toPixels(ns.position.x, ns.position.unit, canvasWidth) * scale
    const y = toPixels(ns.position.y, ns.position.unit, canvasHeight) * scale
    const w = toPixels(ns.size.width, ns.size.unit, canvasWidth) * scale
    const h = toPixels(ns.size.height, ns.size.unit, canvasHeight) * scale

    return (
      <div
        key="nextSlide"
        className="absolute overflow-hidden"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          padding: 16 * scale,
          ...getBackgroundCSS(ns.background),
        }}
      >
        <div
          style={{
            ...getTextStyleCSS(ns.labelStyle),
            fontSize: ns.labelStyle.maxFontSize * scale,
          }}
        >
          {ns.labelText}
        </div>
        <div
          className="mt-2"
          style={{
            ...getTextStyleCSS(ns.contentStyle),
            fontSize: ns.contentStyle.maxFontSize * scale,
          }}
        >
          {nextSlideData?.preview || ''}
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-screen h-screen overflow-hidden cursor-default relative"
      style={
        backgroundConfig
          ? getBackgroundCSS(backgroundConfig)
          : { backgroundColor: '#000' }
      }
      onDoubleClick={toggleFullscreen}
    >
      {isVisible && (
        <>
          {renderMainText()}
          {renderContentText()}
          {renderReferenceText()}
          {renderPersonLabel()}
        </>
      )}
      {renderClock()}
      {renderNextSlideSection()}
    </div>
  )
}
