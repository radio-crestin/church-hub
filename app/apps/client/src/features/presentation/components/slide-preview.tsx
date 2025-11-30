import type { SlideContent, ThemeConfig } from '../service/types'

interface SlidePreviewProps {
  slide: SlideContent
  isActive?: boolean
  onClick?: () => void
  theme?: ThemeConfig
  className?: string
}

const DEFAULT_THEME: Partial<ThemeConfig> = {
  backgroundColor: '#1f2937',
  fontColor: '#ffffff',
  textAlign: 'center',
}

export function SlidePreview({
  slide,
  isActive = false,
  onClick,
  theme,
  className = '',
}: SlidePreviewProps) {
  const mergedTheme = { ...DEFAULT_THEME, ...theme }

  return (
    <button
      onClick={onClick}
      className={`relative w-full aspect-video rounded-lg overflow-hidden transition-all ${
        isActive
          ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900'
          : 'hover:ring-1 hover:ring-gray-400'
      } ${className}`}
      style={{
        backgroundColor: mergedTheme.backgroundColor,
        color: mergedTheme.fontColor,
      }}
    >
      <div
        className="absolute inset-0 p-2 flex items-center justify-center text-xs overflow-hidden"
        style={{ textAlign: mergedTheme.textAlign }}
      >
        <span className="line-clamp-3">{slide.plainText}</span>
      </div>
      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
        {slide.index + 1}
      </div>
    </button>
  )
}
