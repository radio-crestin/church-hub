import { Bold, Highlighter, Underline, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ContextMenuPosition {
  x: number
  y: number
}

interface TextStyleContextMenuProps {
  position: ContextMenuPosition
  onClose: () => void
  onHighlight: () => void
  onBold: () => void
  onUnderline: () => void
  onRemoveStyle?: () => void
  showRemove?: boolean
  highlightColor?: string
}

export function TextStyleContextMenu({
  position,
  onClose,
  onHighlight,
  onBold,
  onUnderline,
  onRemoveStyle,
  showRemove = false,
  highlightColor = '#FFFF00',
}: TextStyleContextMenuProps) {
  const { t } = useTranslation('presentation')
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${position.x - rect.width}px`
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${position.y - rect.height}px`
      }
    }
  }, [position])

  const handleHighlight = () => {
    onHighlight()
    onClose()
  }

  const handleBold = () => {
    onBold()
    onClose()
  }

  const handleUnderline = () => {
    onUnderline()
    onClose()
  }

  const handleRemoveStyle = () => {
    if (onRemoveStyle) {
      onRemoveStyle()
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] py-1 bg-panel rounded-[10px] shadow-popover border border-line"
      style={{ left: position.x, top: position.y }}
    >
      {/* Highlight option */}
      <button
        type="button"
        onClick={handleHighlight}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-fg-body hover:bg-hover transition-colors"
      >
        <Highlighter
          size={14}
          strokeWidth={1.75}
          style={{ color: highlightColor }}
        />
        {t('textStyle.highlight')}
      </button>

      {/* Bold option */}
      <button
        type="button"
        onClick={handleBold}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-fg-body hover:bg-hover transition-colors"
      >
        <Bold size={14} strokeWidth={1.75} />
        {t('textStyle.bold')}
      </button>

      {/* Underline option */}
      <button
        type="button"
        onClick={handleUnderline}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-fg-body hover:bg-hover transition-colors"
      >
        <Underline size={14} strokeWidth={1.75} />
        {t('textStyle.underline')}
      </button>

      {/* Remove style option */}
      {showRemove && onRemoveStyle && (
        <>
          <div className="border-t border-line my-1" />
          <button
            type="button"
            onClick={handleRemoveStyle}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-hover transition-colors"
          >
            <X size={14} strokeWidth={1.75} />
            {t('textStyle.removeStyle')}
          </button>
        </>
      )}
    </div>
  )
}
