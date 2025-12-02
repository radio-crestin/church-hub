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
        const response = await fetch(`${getApiUrl()}/api/displays/${displayId}`)
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

  // Fetch current slide content when presentation state changes
  // Include updatedAt to refetch when navigating to same slide after edit
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
  }, [presentationState?.currentSlideId, presentationState?.updatedAt])

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
      className="w-screen h-screen overflow-hidden cursor-default"
      style={getBackgroundStyle()}
      onDoubleClick={toggleFullscreen}
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
