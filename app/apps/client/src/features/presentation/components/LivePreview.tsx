import { useEffect, useState } from 'react'

import { getApiUrl } from '~/config'
import { ClockOverlay } from './ClockOverlay'
import { SlideRenderer } from './SlideRenderer'
import { usePresentationState, useWebSocket } from '../hooks'
import type { DisplayTheme } from '../types'
import { getDefaultTheme } from '../types'

interface SongSlideData {
  id: number
  content: string
}

interface StandaloneSlideData {
  id: number
  slideContent: string | null
}

export function LivePreview() {
  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const [theme, setTheme] = useState<DisplayTheme>(getDefaultTheme())
  const [currentSongSlide, setCurrentSongSlide] =
    useState<SongSlideData | null>(null)
  const [currentStandaloneSlide, setCurrentStandaloneSlide] =
    useState<StandaloneSlideData | null>(null)

  // Fetch the first active display's theme for preview
  useEffect(() => {
    const fetchDisplayTheme = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/displays`, {
          credentials: 'include',
        })
        if (response.ok) {
          const result = await response.json()
          const activeDisplay = result.data?.find(
            (d: { isActive: boolean }) => d.isActive,
          )
          if (activeDisplay?.theme) {
            setTheme(activeDisplay.theme)
          }
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to fetch display theme:', error)
      }
    }

    fetchDisplayTheme()
  }, [])

  // Fetch current song slide content when presentation state changes
  useEffect(() => {
    const fetchSongSlide = async () => {
      if (!presentationState?.currentSongSlideId) {
        setCurrentSongSlide(null)
        return
      }

      try {
        // Find the song slide from the queue
        const queueResponse = await fetch(`${getApiUrl()}/api/queue`, {
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

  // Fetch current standalone slide content when presentation state changes
  useEffect(() => {
    const fetchStandaloneSlide = async () => {
      // Standalone slide is when we have a queue item but no song slide
      if (
        !presentationState?.currentQueueItemId ||
        presentationState?.currentSongSlideId
      ) {
        setCurrentStandaloneSlide(null)
        return
      }

      try {
        // Find the standalone slide from the queue
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
          if (queueItem && queueItem.itemType === 'slide') {
            setCurrentStandaloneSlide({
              id: queueItem.id,
              slideContent: queueItem.slideContent,
            })
            return
          }
        }
        setCurrentStandaloneSlide(null)
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to fetch standalone slide:', error)
      }
    }

    fetchStandaloneSlide()
  }, [
    presentationState?.currentQueueItemId,
    presentationState?.currentSongSlideId,
    presentationState?.updatedAt,
  ])

  const getBackgroundStyle = (): React.CSSProperties => {
    if (theme.backgroundType === 'transparent') {
      return { backgroundColor: '#1f2937' } // Dark gray for preview
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
  // Show clock only when there's no content (preview always shows selected slide)
  const showClock = !hasContent

  // Get content to display - prioritize song slides, then standalone slides
  const getSlideContent = (): string | null => {
    if (currentSongSlide?.content) {
      return currentSongSlide.content
    }
    if (currentStandaloneSlide?.slideContent) {
      return currentStandaloneSlide.slideContent
    }
    return null
  }

  const slideContent = getSlideContent()

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg">
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={getBackgroundStyle()}
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
    </div>
  )
}
