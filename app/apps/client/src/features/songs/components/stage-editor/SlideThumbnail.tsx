import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, MonitorPlay, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  ScreenBackgroundConfig,
  ScreenWithConfigs,
  TemporaryContent,
} from '~/features/presentation'
import { ScreenPreview, usePresentationContent } from '~/features/presentation'
import { useIsNearView } from '~/hooks/useIsNearView'
import type { LocalSlide } from '../../types'

interface SlideThumbnailProps {
  screen: ScreenWithConfigs
  songId: number
  title: string
  keyLine: string | null
  /** The song's own background, drawn as the projection would. */
  background: ScreenBackgroundConfig | null
  /** Plain black instead of any background (the song page's toggle). */
  hideBackground?: boolean
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
  background,
  hideBackground = false,
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

  // The mini preview renders once the thumbnail comes near the filmstrip's
  // view: drawing every slide of a long song up front held up the stage.
  const [previewRef, isNearView] = useIsNearView<HTMLButtonElement>()

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
          className={`text-xs font-medium tabular-nums ${
            isActive ? 'text-fg' : 'text-fg-hint'
          }`}
        >
          {index + 1}
        </span>
        <button
          type="button"
          className="p-0.5 text-fg-hint hover:text-fg-label cursor-grab touch-none"
          aria-label={t('stageEditor.dragToReorder')}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Mini preview */}
      <button
        ref={previewRef}
        type="button"
        data-testid="stage-thumbnail"
        onClick={onSelect}
        className={`relative flex-1 aspect-video rounded-lg overflow-hidden border transition-colors ${
          isActive
            ? 'border-fg-label ring-1 ring-fg-label'
            : 'border-line hover:border-line-strong'
        }`}
        aria-current={isActive}
      >
        {isNearView ? (
          <ThumbnailPreview
            screen={screen}
            songId={songId}
            title={title}
            keyLine={keyLine}
            background={background}
            hideBackground={hideBackground}
            slides={slides}
            index={index}
          />
        ) : (
          <span className="absolute inset-0 bg-black" />
        )}
        {label && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-black/60 text-white">
            {label}
          </span>
        )}
        {isPresented && (
          <span
            data-testid="stage-thumbnail-live"
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-live ring-2 ring-black/40"
          />
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
            className="absolute bottom-1 left-1 p-1 rounded-md text-white bg-black/60 hover:bg-black/80 transition-colors"
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
            data-testid="thumb-clone"
            onClick={(e) => {
              e.stopPropagation()
              onClone()
            }}
            className="p-1 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
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
            className="p-1 rounded-md bg-black/60 text-white hover:bg-red-600 transition-colors"
            title={t('stageEditor.deleteSlide')}
          >
            <Trash2 size={12} />
          </span>
        </span>
      </button>
    </div>
  )
}

type ThumbnailPreviewProps = Pick<
  SlideThumbnailProps,
  | 'screen'
  | 'songId'
  | 'title'
  | 'keyLine'
  | 'background'
  | 'hideBackground'
  | 'slides'
  | 'index'
>

/** The slide drawn as the screen would show it. */
function ThumbnailPreview({
  screen,
  songId,
  title,
  keyLine,
  background,
  hideBackground = false,
  slides,
  index,
}: ThumbnailPreviewProps) {
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
          styleOverrides: s.styleOverrides ?? null,
        })),
        currentSlideIndex: index,
        background,
      },
    }),
    [songId, title, keyLine, slides, index, background],
  )

  const { contentType, contentData, contentKey, isVisible } =
    usePresentationContent({ screen, includeNextSlide: false, previewContent })

  return (
    <ScreenPreview
      screen={screen}
      contentType={contentType}
      contentData={contentData}
      contentKey={contentKey}
      isVisible={isVisible}
      playVideo={false}
      hideBackground={hideBackground}
    />
  )
}
