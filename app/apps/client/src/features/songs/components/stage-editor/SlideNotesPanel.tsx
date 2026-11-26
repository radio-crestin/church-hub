import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  StickyNote,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const HEIGHT_KEY = 'song-stage:notes-height'
const COLLAPSED_KEY = 'song-stage:notes-collapsed'
const MIN_HEIGHT = 64
const DEFAULT_HEIGHT = 140
const MAX_HEIGHT = 200

interface SlideNotesPanelProps {
  /** 1-based number of the slide the note belongs to (for the header). */
  slideNumber: number
  /** Current note text for the active slide. */
  note: string
  /** Called on every edit with the new note text. */
  onChange: (note: string) => void
  disabled?: boolean
}

/**
 * PowerPoint-style speaker-notes panel that sits below the stage canvas and
 * edits the note for the currently-selected slide. The operator can drag its
 * top edge to resize it, or collapse it to just the header. Height/collapsed
 * state persist per device.
 */
export function SlideNotesPanel({
  slideNumber,
  note,
  onChange,
  disabled,
}: SlideNotesPanelProps) {
  const { t } = useTranslation('songs')
  // Collapsed by default; only expanded once the operator opens it (and then
  // that choice sticks per device).
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) !== 'false',
  )
  const [height, setHeight] = useState(() => {
    const saved = Number(localStorage.getItem(HEIGHT_KEY))
    return saved >= MIN_HEIGHT && saved <= MAX_HEIGHT ? saved : DEFAULT_HEIGHT
  })
  const draggingRef = useRef(false)

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  }, [collapsed])
  useEffect(() => {
    localStorage.setItem(HEIGHT_KEY, String(height))
  }, [height])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = true
      const startY = e.clientY
      const startHeight = height

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return
        // Dragging up grows the panel (it lives at the bottom of the column).
        const next = startHeight + (startY - ev.clientY)
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next)))
      }
      const onUp = () => {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [height],
  )

  return (
    <div
      data-testid="slide-notes-panel"
      className="mt-2 flex shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-panel"
    >
      {/* Drag-to-resize handle (desktop only, expanded only) */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          title={t('stageEditor.notes.resize')}
          className="group hidden h-2 shrink-0 cursor-row-resize items-center justify-center hover:bg-hover lg:flex"
        >
          <GripHorizontal
            size={14}
            className="text-fg-hint transition-colors group-hover:text-fg-label"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        data-testid="slide-notes-toggle"
        className="flex items-center justify-between gap-2 px-3 py-1.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-fg-label">
          <StickyNote size={13} />
          {t('stageEditor.notes.title')}
          <span className="text-fg-hint">#{slideNumber}</span>
        </span>
        {collapsed ? (
          <ChevronUp size={14} className="text-fg-hint" />
        ) : (
          <ChevronDown size={14} className="text-fg-hint" />
        )}
      </button>

      {!collapsed && (
        <textarea
          value={note}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={t('stageEditor.notes.placeholder')}
          data-testid="slide-notes-textarea"
          style={{ height }}
          className="w-full resize-none border-t border-line bg-transparent px-3 py-2 text-sm text-fg placeholder:text-fg-hint focus:outline-none"
        />
      )}
    </div>
  )
}
