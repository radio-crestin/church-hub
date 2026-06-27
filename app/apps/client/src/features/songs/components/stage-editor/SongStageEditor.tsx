import { type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { GripVertical, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TemporaryContent } from '~/features/presentation'
import { usePreviewScreen } from '~/features/presentation'
import { useDividerPosition } from '~/hooks/useDividerPosition'
import { ConfirmModal } from '~/ui/modal'
import { SlideFilmstrip } from './SlideFilmstrip'
import { StageCanvas } from './StageCanvas'
import { plainTextToSlideHtml } from '../../utils/plainTextToSlideHtml'
import { type LocalSlide } from '../SongSlideList'

interface SongStageEditorProps {
  slides: LocalSlide[]
  title: string
  keyLine: string | null
  songId: number | null
  presentedSlideId?: number | null
  /** When false the canvas is read-only (presentation/navigation mode). */
  editable?: boolean
  /** Project a slide to the screen by its index, without moving the editor. */
  onProjectSlide?: (index: number) => void
  onSlidesChange: (slides: LocalSlide[]) => void
}

function reindex(slides: LocalSlide[]): LocalSlide[] {
  return slides.map((s, idx) => ({ ...s, sortOrder: idx }))
}

/**
 * PowerPoint-style song editor: a filmstrip of slide thumbnails plus a large
 * canvas that renders the current slide exactly as it will be projected and
 * lets the operator edit the lyrics directly on it.
 */
export function SongStageEditor({
  slides,
  title,
  keyLine,
  songId,
  presentedSlideId,
  editable = true,
  onProjectSlide,
  onSlidesChange,
}: SongStageEditorProps) {
  const { t } = useTranslation('songs')
  const { screen, isLoading } = usePreviewScreen()

  // Resizable split between the filmstrip (column 1) and the canvas, persisted
  // per device. Only applied on large screens; on mobile the two stack.
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [dividerPosition, setDividerPosition] = useDividerPosition(
    'song-stage:filmstrip',
    24,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsLargeScreen(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const next = ((moveEvent.clientX - rect.left) / rect.width) * 100
        setDividerPosition(Math.min(50, Math.max(14, next)))
      }
      const handleMouseUp = () => {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setDividerPosition],
  )

  // Track the active slide by id so the selection survives reordering/deletion.
  const [activeId, setActiveId] = useState<LocalSlide['id'] | null>(
    slides[0]?.id ?? null,
  )
  const [slideToDelete, setSlideToDelete] = useState<LocalSlide | null>(null)

  const activeIndex = useMemo(() => {
    const idx = slides.findIndex((s) => s.id === activeId)
    if (idx >= 0) return idx
    return slides.length > 0 ? 0 : -1
  }, [slides, activeId])

  const effectiveIndex = activeIndex < 0 ? 0 : activeIndex
  const effectiveSongId = songId ?? 0

  const previewContent = useMemo<TemporaryContent>(
    () => ({
      type: 'song',
      data: {
        songId: effectiveSongId,
        title,
        keyLine,
        slides: slides.map((s) => ({
          id: typeof s.id === 'number' ? s.id : 0,
          content: s.content,
          chords: s.chords ?? null,
          sortOrder: s.sortOrder,
        })),
        currentSlideIndex: effectiveIndex,
      },
    }),
    [effectiveSongId, title, keyLine, slides, effectiveIndex],
  )

  const handleSelect = useCallback(
    (index: number) => setActiveId(slides[index]?.id ?? null),
    [slides],
  )

  const handleEditText = useCallback(
    (plainText: string) => {
      if (activeIndex < 0) return
      const id = slides[activeIndex].id
      const content = plainTextToSlideHtml(plainText)
      onSlidesChange(slides.map((s) => (s.id === id ? { ...s, content } : s)))
    },
    [activeIndex, slides, onSlidesChange],
  )

  const handleAdd = useCallback(() => {
    const newSlide: LocalSlide = {
      id: `temp-${Date.now()}`,
      content: '',
      sortOrder: slides.length,
    }
    onSlidesChange([...slides, newSlide])
    setActiveId(newSlide.id)
  }, [slides, onSlidesChange])

  const handleClone = useCallback(
    (slide: LocalSlide) => {
      const index = slides.findIndex((s) => s.id === slide.id)
      const clone: LocalSlide = {
        id: `temp-${Date.now()}`,
        content: slide.content,
        chords: slide.chords ? [...slide.chords] : null,
        sortOrder: index + 1,
        label: slide.label,
      }
      onSlidesChange(
        reindex([
          ...slides.slice(0, index + 1),
          clone,
          ...slides.slice(index + 1),
        ]),
      )
      setActiveId(clone.id)
    },
    [slides, onSlidesChange],
  )

  const handleDeleteConfirm = useCallback(() => {
    if (!slideToDelete) return
    const index = slides.findIndex((s) => s.id === slideToDelete.id)
    const next = reindex(slides.filter((s) => s.id !== slideToDelete.id))
    onSlidesChange(next)
    // Select a sensible neighbour after deletion.
    const neighbour = next[Math.min(index, next.length - 1)]
    setActiveId(neighbour?.id ?? null)
    setSlideToDelete(null)
  }, [slideToDelete, slides, onSlidesChange])

  const handleReorder = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = slides.findIndex((s) => s.id === active.id)
      const newIndex = slides.findIndex((s) => s.id === over.id)
      onSlidesChange(reindex(arrayMove(slides, oldIndex, newIndex)))
    },
    [slides, onSlidesChange],
  )

  if (isLoading || !screen) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col lg:flex-row gap-3 lg:gap-1"
    >
      {/* Filmstrip (column 1, resizable) */}
      <div
        className="order-2 lg:order-1 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1"
        style={isLargeScreen ? { width: `${dividerPosition}%` } : undefined}
      >
        <SlideFilmstrip
          screen={screen}
          songId={effectiveSongId}
          title={title}
          keyLine={keyLine}
          slides={slides}
          activeIndex={activeIndex}
          presentedSlideId={presentedSlideId}
          onSelect={handleSelect}
          onReorder={handleReorder}
          onClone={handleClone}
          onDelete={setSlideToDelete}
          onAdd={handleAdd}
          onProject={onProjectSlide}
        />
      </div>

      {/* Draggable divider */}
      <div
        className="hidden lg:flex lg:order-2 items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group shrink-0"
        onMouseDown={handleDividerMouseDown}
      >
        <GripVertical
          size={16}
          className="text-gray-400 group-hover:text-indigo-500 transition-colors"
        />
      </div>

      {/* Canvas */}
      <div className="order-1 lg:order-3 lg:flex-1 lg:min-w-0">
        <StageCanvas
          screen={screen}
          previewContent={previewContent}
          canEdit={editable && activeIndex >= 0}
          onEditText={handleEditText}
        />
      </div>

      <ConfirmModal
        isOpen={!!slideToDelete}
        onCancel={() => setSlideToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={t('modal.deleteSlideTitle')}
        message={t('modal.deleteSlideMessage')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('common:buttons.cancel', 'Cancel')}
        variant="danger"
      />
    </div>
  )
}
