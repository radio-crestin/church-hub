import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  FileText,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import type { SongSlide, SongWithSlides } from '../types'
import { expandSongSlidesWithChoruses } from '../utils/expandSongSlides'

interface SongSlidesPanelProps {
  song: SongWithSlides
  presentedSlideIndex: number | null
  selectedSlideIndex: number
  isLoading: boolean
  isEditMode: boolean
  onToggleEditMode: () => void
  onSlideClick: (slide: SongSlide, index: number) => void
  onSlideEdit?: (slideId: number, content: string) => Promise<void>
  onSlideDelete?: (slideId: number) => Promise<void>
  onSlideAdd?: () => Promise<void>
  onSlidesReorder?: (slideIds: number[]) => Promise<void>
  onEditAsText?: () => void
}

const SCROLL_OFFSET_TOP = 100

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.textContent = text
  return textarea.textContent || ''
}

function stripHtmlTags(html: string): string {
  const stripped = html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
  return decodeHtmlEntities(stripped)
}

function plainTextToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      return `<p>${escaped || '<br>'}</p>`
    })
    .join('')
}

/** Inline editable slide with drag handle for edit mode */
function EditableSlide({
  slide,
  slideNumber,
  isPresented,
  onEdit,
  onDelete,
}: {
  slide: SongSlide
  slideNumber: number
  isPresented: boolean
  onEdit: (slideId: number, content: string) => void
  onDelete?: (slideId: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const [content, setContent] = useState(() => stripHtmlTags(slide.content))
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevContentRef = useRef(slide.content)

  // Sync when external content changes (e.g., after API save)
  useEffect(() => {
    if (slide.content !== prevContentRef.current) {
      setContent(stripHtmlTags(slide.content))
      prevContentRef.current = slide.content
    }
  }, [slide.content])

  // Auto-resize textarea
  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const handleBlur = useCallback(() => {
    const currentPlain = stripHtmlTags(slide.content)
    if (content !== currentPlain) {
      onEdit(slide.id, plainTextToHtml(content))
    }
  }, [content, slide.id, slide.content, onEdit])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-1.5 px-2 py-2 rounded-lg border transition-colors ${
        isPresented
          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700'
      } ${isDragging ? 'opacity-50 shadow-lg z-10' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing p-0.5 mt-0.5 shrink-0 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} className="text-gray-400" />
      </button>
      <span
        className={`font-semibold text-sm min-w-[20px] mt-0.5 shrink-0 ${
          isPresented
            ? 'text-green-700 dark:text-green-300'
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {slideNumber}
      </span>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        className="flex-1 text-sm bg-transparent resize-none overflow-hidden focus:outline-none leading-relaxed text-gray-900 dark:text-gray-100 min-h-[20px]"
        spellCheck={false}
      />
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(slide.id)
          }}
          className="p-1 mt-0.5 shrink-0 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

export function SongSlidesPanel({
  song,
  presentedSlideIndex,
  selectedSlideIndex,
  isLoading,
  isEditMode,
  onToggleEditMode,
  onSlideClick,
  onSlideEdit,
  onSlideDelete,
  onSlideAdd,
  onSlidesReorder,
  onEditAsText,
}: SongSlidesPanelProps) {
  const { t } = useTranslation('songs')
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAdding, setIsAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Sorted original slides for edit mode
  const sortedSlides = useMemo(
    () => [...song.slides].sort((a, b) => a.sortOrder - b.sortOrder),
    [song.slides],
  )

  const slideIds = useMemo(
    () => sortedSlides.map((s) => s.id),
    [sortedSlides],
  )

  // Expanded slides for view mode
  const expandedSlides = useMemo(
    () => expandSongSlidesWithChoruses(song.slides),
    [song.slides],
  )

  // Presented slide ID for edit mode highlighting
  const presentedSlideId = useMemo(() => {
    if (presentedSlideIndex === null) return null
    return expandedSlides[presentedSlideIndex]?.id ?? null
  }, [presentedSlideIndex, expandedSlides])

  // Track chorus duplicates for view mode
  const isOriginalSlide = useMemo(() => {
    const seen = new Set<number>()
    return expandedSlides.map((slide) => {
      if (seen.has(slide.id)) return false
      seen.add(slide.id)
      return true
    })
  }, [expandedSlides])

  // Auto-scroll to presented slide (view mode)
  useEffect(() => {
    if (!isEditMode && highlightedRef.current && containerRef.current) {
      const container = containerRef.current
      const element = highlightedRef.current
      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const elementTop =
        elementRect.top - containerRect.top + container.scrollTop
      const targetScrollTop = Math.max(0, elementTop - SCROLL_OFFSET_TOP)
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
    }
  }, [presentedSlideIndex, isEditMode])

  // Auto-scroll to selected slide (view mode)
  useEffect(() => {
    if (
      !isEditMode &&
      presentedSlideIndex === null &&
      selectedRef.current &&
      containerRef.current
    ) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [selectedSlideIndex, presentedSlideIndex, isEditMode])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !onSlidesReorder) return

      const oldIndex = slideIds.indexOf(active.id as number)
      const newIndex = slideIds.indexOf(over.id as number)
      if (oldIndex === -1 || newIndex === -1) return

      const newOrder = arrayMove(slideIds, oldIndex, newIndex)
      void onSlidesReorder(newOrder)
    },
    [slideIds, onSlidesReorder],
  )

  const handleAddSlide = useCallback(async () => {
    if (!onSlideAdd) return
    setIsAdding(true)
    try {
      await onSlideAdd()
    } finally {
      setIsAdding(false)
    }
  }, [onSlideAdd])

  const handleSlideEdit = useCallback(
    (slideId: number, content: string) => {
      void onSlideEdit?.(slideId, content)
    },
    [onSlideEdit],
  )

  const handleSlideDelete = useCallback(
    (slideId: number) => {
      void onSlideDelete?.(slideId)
    },
    [onSlideDelete],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          {!isEditMode ? (
            <button
              type="button"
              onClick={onToggleEditMode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/60"
            >
              <Pencil size={14} />
              <span>{t('preview.editMode')}</span>
            </button>
          ) : (
            onEditAsText && (
              <button
                type="button"
                onClick={onEditAsText}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FileText size={14} />
                <span className="hidden sm:inline">
                  {t('preview.editAsText')}
                </span>
              </button>
            )
          )}
        </div>
        {isEditMode && (
          <button
            type="button"
            onClick={onToggleEditMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/60"
          >
            <Check size={14} />
            <span>{t('preview.exitEditMode')}</span>
          </button>
        )}
      </div>

      {/* Slides */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden lg:overflow-y-auto scrollbar-thin px-0.5 py-0.5"
      >
        {isEditMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={slideIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sortedSlides.map((slide, index) => (
                  <EditableSlide
                    key={slide.id}
                    slide={slide}
                    slideNumber={index + 1}
                    isPresented={slide.id === presentedSlideId}
                    onEdit={handleSlideEdit}
                    onDelete={
                      onSlideDelete ? handleSlideDelete : undefined
                    }
                  />
                ))}
                {onSlideAdd && (
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    disabled={isAdding}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border-2 border-dashed transition-colors border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600 disabled:opacity-50"
                  >
                    {isAdding ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    {t('preview.addSlide')}
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-1">
            {expandedSlides.map((slide, index) => {
              const isPresented = index === presentedSlideIndex
              const isSelected =
                index === selectedSlideIndex &&
                presentedSlideIndex === null
              const isDuplicate = !isOriginalSlide[index]
              const plainText = stripHtmlTags(slide.content)

              const getButtonClass = () => {
                if (isPresented)
                  return 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
                if (isSelected)
                  return 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500'
                return 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }

              const getNumberClass = () => {
                if (isPresented)
                  return 'text-green-700 dark:text-green-300'
                if (isSelected)
                  return 'text-indigo-700 dark:text-indigo-300'
                return 'text-gray-500 dark:text-gray-400'
              }

              const getTextClass = () => {
                if (isPresented)
                  return 'text-green-900 dark:text-green-100'
                if (isSelected)
                  return 'text-indigo-900 dark:text-indigo-100'
                return 'text-gray-700 dark:text-gray-200'
              }

              const getRef = () => {
                if (isPresented) return highlightedRef
                if (isSelected) return selectedRef
                return null
              }

              return (
                <button
                  key={`${slide.id}-${index}`}
                  ref={getRef()}
                  type="button"
                  onClick={() =>
                    !isPresented && onSlideClick(slide, index)
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors group ${getButtonClass()} ${
                    isDuplicate ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`font-semibold text-sm min-w-[24px] ${getNumberClass()}`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={`text-sm whitespace-pre-line flex-1 ${getTextClass()}`}
                    >
                      {plainText}
                    </span>
                    {isDuplicate && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic shrink-0">
                        {t('preview.chorusRepeat')}
                      </span>
                    )}
                  </div>
                  {slide.label && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-8 mt-1 block">
                      {slide.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
