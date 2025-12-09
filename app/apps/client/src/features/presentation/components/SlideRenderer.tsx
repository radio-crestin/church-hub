import { useEffect, useRef, useState } from 'react'

import type { DisplayTheme } from '../types'

interface SlideRendererProps {
  content: string
  theme: DisplayTheme
}

export function SlideRenderer({ content, theme }: SlideRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(48)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Track container size changes
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Auto-fit text to container with size-relative scaling
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const textElement = container.querySelector('.slide-text') as HTMLElement
    if (!textElement) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Scale font sizes relative to container dimensions
    // Use the smaller dimension to ensure text fits in both directions
    const baseUnit = Math.min(containerWidth, containerHeight)

    // Start at 15% of container size, with a reasonable max for large screens
    let currentSize = Math.min(baseUnit * 0.15, 120)
    // Minimum at 2% of container size, with a floor of 8px for readability
    const minSize = Math.max(baseUnit * 0.02, 8)

    const padding = Math.min(theme.padding || 40, baseUnit * 0.05)

    const maxWidth = containerWidth - padding * 2
    const maxHeight = containerHeight - padding * 2

    textElement.style.fontSize = `${currentSize}px`

    // Step size relative to container for smoother scaling
    const step = Math.max(baseUnit * 0.005, 1)

    while (
      (textElement.scrollWidth > maxWidth ||
        textElement.scrollHeight > maxHeight) &&
      currentSize > minSize
    ) {
      currentSize -= step
      textElement.style.fontSize = `${currentSize}px`
    }

    setFontSize(currentSize)
  }, [content, theme.padding, containerSize])

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
