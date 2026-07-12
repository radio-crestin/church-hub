import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, MonitorPlay, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  ScreenWithConfigs,
  TemporaryContent,
} from '~/features/presentation'
import { ScreenPreview, usePresentationContent } from '~/features/presentation'
import type { LocalSlide } from '../SongSlideList'

interface SlideThumbnailProps {
  screen: ScreenWithConfigs
  songId: number
  title: string
  keyLine: string | null
  slides: LocalSlide[]
  index: number
  isActive: boolean
  isPresented: boolean
  onSelect: () => void
  onClone: () => void
  onDelete: () => void
  /** Project this slide to the screen, without changing the edited slide. */
  onProject?: () => void
}

/**
 * One slide in the PowerPoint-style filmstrip. Renders a true-to-projection
 * mini preview via the shared presentation content hook, and is sortable for
 * drag-to-reorder.
 */
export function SlideThumbnail({
  screen,
  songId,
  title,
  keyLine,
  slides,
  index,
  isActive,
  isPresented,
  onSelect,
  onClone,
  onDelete,
  onProject,
}: SlideThumbnailProps) {
  const { t } = useTranslation('songs')
  const slide = slides[index]

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const previewContent = useMemo<TemporaryContent>(
    () => ({
      type: 'song',
      data: {
        songId,
        title,
        keyLine,
        slides: slides.map((s) => ({
          id: typeof s.id === 'number' ? s.id : 0,
          content: s.content,
          chords: s.chords ?? null,
          sortOrder: s.sortOrder,
        })),
        currentSlideIndex: index,
      },
    }),
    [songId, title, keyLine, slides, index],
  )

  const { contentType, contentData, contentKey, isVisible } =
    usePresentationContent({ screen, includeNextSlide: false, previewContent })

  const label = slide.label?.trim()

  return (
    <div
      ref={setNodeRef}
      data-slide-index={index}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="group flex items-stretch gap-2"
    >
      {/* Drag handle + slide number */}
      <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
        <span
          className={`text-xs font-semibold tabular-nums ${
            isActive
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {index + 1}
        </span>
        <button
          type="button"
          className="p-0.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 cursor-grab touch-none"
          aria-label={t('stageEditor.dragToReorder')}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
      </div>

      {/* Mini preview */}
      <button
        type="button"
        data-testid="stage-thumbnail"
        onClick={onSelect}
        className={`relative flex-1 aspect-video rounded-md overflow-hidden border-2 transition-all ${
          isActive
            ? 'border-indigo-500 ring-2 ring-indigo-500/30'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
        aria-current={isActive}
      >
        <ScreenPreview
          screen={screen}
          contentType={contentType}
          contentData={contentData}
          contentKey={contentKey}
          isVisible={isVisible}
        />
        {label && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-black/60 text-white">
            {label}
          </span>
        )}
        {isPresented && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 ring-2 ring-white/70" />
        )}

        {/* Project this slide to the screen — independent of the edited slide */}
        {onProject && (
          <span
            role="button"
            tabIndex={-1}
            data-testid="thumb-project"
            onClick={(e) => {
              e.stopPropagation()
              onProject()
            }}
            className="absolute bottom-1 left-1 p-1 rounded text-white bg-green-600 hover:bg-green-700 transition-colors"
            title={t('stageEditor.projectSlide')}
          >
            <MonitorPlay size={12} />
          </span>
        )}

        {/* Hover controls */}
        <span className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              onClone()
            }}
            className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            title={t('stageEditor.cloneSlide')}
          >
            <Copy size={12} />
          </span>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 rounded bg-red-600 text-white hover:bg-red-700"
            title={t('stageEditor.deleteSlide')}
          >
            <Trash2 size={12} />
          </span>
        </span>
      </button>
    </div>
  )
}
