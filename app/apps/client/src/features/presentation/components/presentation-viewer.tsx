import { useCallback, useEffect, useState } from 'react'

import { usePresentationSocket } from '../hooks/use-presentation-socket'
import type { SlideChangeMessage, ThemeConfig } from '../service/types'

interface PresentationViewerProps {
  displayId?: number
  defaultTheme?: ThemeConfig
  className?: string
}

const DEFAULT_THEME: ThemeConfig = {
  fontFamily: 'sans-serif',
  fontSize: 48,
  fontColor: '#ffffff',
  backgroundColor: '#000000',
  textAlign: 'center',
  padding: 40,
}

export function PresentationViewer({
  displayId,
  defaultTheme = DEFAULT_THEME,
  className = '',
}: PresentationViewerProps) {
  const [currentSlide, setCurrentSlide] = useState<
    SlideChangeMessage['payload'] | null
  >(null)
  const [theme] = useState<ThemeConfig>(defaultTheme)

  const handleSlideChange = useCallback(
    (payload: SlideChangeMessage['payload']) => {
      setCurrentSlide(payload)
    },
    [],
  )

  const { isConnected, error } = usePresentationSocket({
    role: 'display',
    displayId,
    onSlideChange: handleSlideChange,
  })

  // Listen for keyboard navigation (for local testing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow local testing with arrow keys
      if (e.key === 'Escape') {
        setCurrentSlide(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const containerStyle: React.CSSProperties = {
    backgroundColor: theme.backgroundColor,
    backgroundImage: theme.backgroundImage
      ? `url(${theme.backgroundImage})`
      : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: theme.fontColor,
    fontFamily: theme.fontFamily,
    fontSize: `${theme.fontSize}px`,
    textAlign: theme.textAlign,
    padding: `${theme.padding}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
  }

  // Show blank screen if no slide
  if (!currentSlide) {
    return (
      <div className={className} style={containerStyle}>
        {!isConnected && (
          <div className="text-sm opacity-50">
            {error ? `Error: ${error}` : 'Connecting...'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={className} style={containerStyle}>
      <div
        className="presentation-content"
        dangerouslySetInnerHTML={{ __html: currentSlide.content }}
      />
    </div>
  )
}
