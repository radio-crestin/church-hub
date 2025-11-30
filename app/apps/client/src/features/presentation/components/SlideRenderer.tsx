import { useEffect, useRef, useState } from 'react'

import type { DisplayTheme } from '../types'

interface SlideRendererProps {
  content: string
  theme: DisplayTheme
}

export function SlideRenderer({ content, theme }: SlideRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(48)

  // Auto-fit text to container
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const textElement = container.querySelector('.slide-text') as HTMLElement
    if (!textElement) return

    // Start with a large font size and reduce until it fits
    let currentSize = 120
    const minSize = 16
    const padding = theme.padding || 40

    const maxWidth = container.clientWidth - padding * 2
    const maxHeight = container.clientHeight - padding * 2

    textElement.style.fontSize = `${currentSize}px`

    while (
      (textElement.scrollWidth > maxWidth ||
        textElement.scrollHeight > maxHeight) &&
      currentSize > minSize
    ) {
      currentSize -= 2
      textElement.style.fontSize = `${currentSize}px`
    }

    setFontSize(currentSize)
  }, [content, theme.padding])

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

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
      style={{
        ...getBackgroundStyle(),
        padding: theme.padding || 40,
      }}
    >
      <div
        className="slide-text text-center"
        style={{
          color: theme.textColor || '#ffffff',
          fontFamily: theme.fontFamily || 'system-ui',
          fontSize: `${fontSize}px`,
          lineHeight: 1.3,
          wordWrap: 'break-word',
          maxWidth: '100%',
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  )
}
