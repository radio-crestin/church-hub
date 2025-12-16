import { useCallback, useEffect, useState } from 'react'

import { getApiUrl } from '~/config'
import { ClockOverlay } from './ClockOverlay'
import { SlideRenderer } from './SlideRenderer'
import { usePresentationState, useWebSocket } from '../hooks'
import type { DisplayTheme } from '../types'
import { getDefaultTheme } from '../types'
import { toggleWindowFullscreen } from '../utils/fullscreen'
import { isTauri } from '../utils/openDisplayWindow'

interface DisplayWindowProps {
  displayId: number
}

interface SongSlideData {
  id: number
  content: string
}

interface StandaloneSlideData {
  id: number
  slideContent: string | null
}

interface BibleVerseData {
  id: number
  reference: string | null
  text: string | null
  translation: string | null
}

export function DisplayWindow({ displayId }: DisplayWindowProps) {
  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const [theme, setTheme] = useState<DisplayTheme>(getDefaultTheme())
  const [currentSongSlide, setCurrentSongSlide] =
    useState<SongSlideData | null>(null)
  const [currentStandaloneSlide, setCurrentStandaloneSlide] =
    useState<StandaloneSlideData | null>(null)
  const [currentBibleVerse, setCurrentBibleVerse] =
    useState<BibleVerseData | null>(null)

  // Toggle fullscreen for this display window
  const toggleFullscreen = useCallback(async () => {
    if (isTauri()) {
      try {
        // For webview windows, use getCurrentWebviewWindow
        const { getCurrentWebviewWindow } = await import(
          '@tauri-apps/api/webviewWindow'
        )
        const win = getCurrentWebviewWindow()
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
        console.log('[DisplayWindow] Toggling fullscreen, current window:', win)
        await toggleWindowFullscreen(win)
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to toggle fullscreen:', error)
      }
    } else {
      // Fallback for browser: use Fullscreen API
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
    }
  }, [])

  // Handle keyboard shortcuts (F11 for fullscreen, Escape to exit)
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

  // Fetch display theme
  useEffect(() => {
    const fetchDisplay = async () => {
      try {
        const response = await fetch(
          `${getApiUrl()}/api/displays/${displayId}`,
          {
            credentials: 'include',
          },
        )
        if (response.ok) {
          const result = await response.json()
          setTheme(result.data.theme)
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to fetch display:', error)
      }
    }

    fetchDisplay()
  }, [displayId])

  // Fetch current song slide content when presentation state changes
  useEffect(() => {
    const fetchSongSlide = async () => {
      if (!presentationState?.currentSongSlideId) {
        setCurrentSongSlide(null)
        return
      }

      try {
        // Find the song slide from the queue
        // Use cache-busting to ensure fresh data
        const queueResponse = await fetch(`${getApiUrl()}/api/queue`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          credentials: 'include',
        })
        if (queueResponse.ok) {
          const queueResult = await queueResponse.json()
          // Search through queue items to find the slide
          for (const item of queueResult.data || []) {
            const slide = item.slides?.find(
              (s: SongSlideData) =>
                s.id === presentationState.currentSongSlideId,
            )
            if (slide) {
              setCurrentSongSlide(slide)
              return
            }
          }
        }
        setCurrentSongSlide(null)
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to fetch song slide:', error)
      }
    }

    fetchSongSlide()
  }, [presentationState?.currentSongSlideId, presentationState?.updatedAt])

  // Fetch current standalone slide or Bible verse content when presentation state changes
  useEffect(() => {
    const fetchStandaloneContent = async () => {
      // Standalone content is when we have a queue item but no song slide
      if (
        !presentationState?.currentQueueItemId ||
        presentationState?.currentSongSlideId
      ) {
        setCurrentStandaloneSlide(null)
        setCurrentBibleVerse(null)
        return
      }

      try {
        // Find the standalone slide or Bible verse from the queue
        // Use cache-busting to ensure fresh data
        const queueResponse = await fetch(`${getApiUrl()}/api/queue`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          credentials: 'include',
        })
        if (queueResponse.ok) {
          const queueResult = await queueResponse.json()
          // Find the queue item
          const queueItem = (queueResult.data || []).find(
            (item: { id: number }) =>
              item.id === presentationState.currentQueueItemId,
          )
          if (queueItem) {
            if (queueItem.itemType === 'slide') {
              setCurrentStandaloneSlide({
                id: queueItem.id,
                slideContent: queueItem.slideContent,
              })
              setCurrentBibleVerse(null)
              return
            }
            if (queueItem.itemType === 'bible') {
              setCurrentBibleVerse({
                id: queueItem.id,
                reference: queueItem.bibleReference,
                text: queueItem.bibleText,
                translation: queueItem.bibleTranslation,
              })
              setCurrentStandaloneSlide(null)
              return
            }
          }
        }
        setCurrentStandaloneSlide(null)
        setCurrentBibleVerse(null)
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to fetch standalone content:', error)
      }
    }

    fetchStandaloneContent()
  }, [
    presentationState?.currentQueueItemId,
    presentationState?.currentSongSlideId,
    presentationState?.updatedAt,
  ])

  const getBackgroundStyle = (): React.CSSProperties => {
    if (theme.backgroundType === 'transparent') {
      return { backgroundColor: 'transparent' }
    }

    if (theme.backgroundType === 'image' && theme.backgroundImage) {
      return {
        backgroundImage: `url(${theme.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }

    return { backgroundColor: theme.backgroundColor || '#000000' }
  }

  // Determine what to show - has content if any slide type is active
  // For standalone slides: currentQueueItemId is set but currentSongSlideId is null
  const hasStandaloneSlide =
    presentationState?.currentQueueItemId &&
    !presentationState?.currentSongSlideId
  const hasContent = presentationState?.currentSongSlideId || hasStandaloneSlide
  // Show clock when hidden or no content
  const showClock = !hasContent || presentationState?.isHidden

  // Get content to display - prioritize song slides, then standalone slides, then Bible verses
  const getSlideContent = (): string | null => {
    if (currentSongSlide?.content) {
      return currentSongSlide.content
    }
    if (currentStandaloneSlide?.slideContent) {
      return currentStandaloneSlide.slideContent
    }
    if (currentBibleVerse?.text) {
      // Format Bible verse with reference at top (same size), no translation version
      // Remove translation suffix (e.g., " - RCCV") from reference
      const fullReference = currentBibleVerse.reference || ''
      const reference = fullReference.replace(/\s*-\s*[A-Z]+\s*$/, '')
      return `${reference}<br>${currentBibleVerse.text}`
    }
    return null
  }

  const slideContent = getSlideContent()

  return (
    <div
      className="w-screen h-screen overflow-hidden cursor-default"
      style={getBackgroundStyle()}
      onDoubleClick={toggleFullscreen}
    >
      {showClock ? (
        <ClockOverlay
          textColor={theme.textColor}
          fontFamily={theme.fontFamily}
        />
      ) : slideContent ? (
        <SlideRenderer content={slideContent} theme={theme} />
      ) : (
        <ClockOverlay
          textColor={theme.textColor}
          fontFamily={theme.fontFamily}
        />
      )}
    </div>
  )
}
