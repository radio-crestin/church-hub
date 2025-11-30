import { useEffect, useState } from 'react'

import { getApiUrl } from '~/config'
import { ClockOverlay } from './ClockOverlay'
import { SlideRenderer } from './SlideRenderer'
import { usePresentationState, useWebSocket } from '../hooks'
import type { DisplayTheme } from '../types'
import { getDefaultTheme } from '../types'

interface DisplayWindowProps {
  displayId: number
}

interface SlideData {
  id: number
  content: {
    html?: string
  }
}

export function DisplayWindow({ displayId }: DisplayWindowProps) {
  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const [theme, setTheme] = useState<DisplayTheme>(getDefaultTheme())
  const [currentSlide, setCurrentSlide] = useState<SlideData | null>(null)

  // Fetch display theme
  useEffect(() => {
    const fetchDisplay = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/displays/${displayId}`)
        if (response.ok) {
          const display = await response.json()
          setTheme(display.theme)
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to fetch display:', error)
      }
    }

    fetchDisplay()
  }, [displayId])

  // Fetch current slide content when presentation state changes
  useEffect(() => {
    const fetchSlide = async () => {
      if (!presentationState?.currentSlideId) {
        setCurrentSlide(null)
        return
      }

      try {
        const response = await fetch(
          `${getApiUrl()}/api/slides/${presentationState.currentSlideId}`,
        )
        if (response.ok) {
          const slide = await response.json()
          setCurrentSlide(slide)
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: error logging
        console.error('Failed to fetch slide:', error)
      }
    }

    fetchSlide()
  }, [presentationState?.currentSlideId])

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

  // Show clock when not presenting or no current slide
  const showClock =
    !presentationState?.isPresenting || !presentationState?.currentSlideId

  return (
    <div
      className="w-screen h-screen overflow-hidden"
      style={getBackgroundStyle()}
    >
      {showClock ? (
        <ClockOverlay
          textColor={theme.textColor}
          fontFamily={theme.fontFamily}
        />
      ) : currentSlide?.content?.html ? (
        <SlideRenderer content={currentSlide.content.html} theme={theme} />
      ) : (
        <ClockOverlay
          textColor={theme.textColor}
          fontFamily={theme.fontFamily}
        />
      )}
    </div>
  )
}
