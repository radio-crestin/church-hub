import { type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TemporaryContent } from '~/features/presentation'
import { usePreviewScreen } from '~/features/presentation'
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
    <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6">
      {/* Filmstrip */}
      <div className="lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2 order-2 lg:order-1">
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

      {/* Canvas */}
      <div className="order-1 lg:order-2">
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
