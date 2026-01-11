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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  Book,
  Camera,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  GripVertical,
  Loader2,
  Megaphone,
  Music,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentationState } from '~/features/presentation'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { ScheduleItemContextMenu } from './ScheduleItemContextMenu'
import type { ScheduleItem } from '../types'

interface ScheduleItemsPanelProps {
  items: ScheduleItem[]
  isLoading: boolean
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
  onVerseClick: (item: ScheduleItem, verseIndex: number) => void
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
  onAnnouncementClick: (item: ScheduleItem) => void
  onSceneClick?: (item: ScheduleItem) => void
  onReorder?: (oldIndex: number, newIndex: number) => void
  onEditSong?: (songId: number) => void
  onNavigateToSong?: (songId: number) => void
  onDeleteItem?: (item: ScheduleItem) => void
  onEditItem?: (item: ScheduleItem) => void
  onChangeSong?: (item: ScheduleItem) => void
  expandAllTrigger?: number
  collapseAllTrigger?: number
}

interface ContextMenuState {
  item: ScheduleItem | null
  position: { x: number; y: number }
}

/**
 * Decode HTML entities to their corresponding characters
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

/**
 * Strip HTML tags and extract plain text content
 */
function stripHtmlTags(html: string): string {
  const stripped = html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()

  return decodeHtmlEntities(stripped)
}

interface ExpandedState {
  [key: string]: boolean
}

export function ScheduleItemsPanel({
  items,
  isLoading,
  onSlideClick,
  onVerseClick,
  onEntryClick,
  onAnnouncementClick,
  onSceneClick,
  onReorder,
  onEditSong,
  onNavigateToSong,
  onDeleteItem,
  onEditItem,
  onChangeSong,
  expandAllTrigger,
  collapseAllTrigger,
}: ScheduleItemsPanelProps) {
  const { t } = useTranslation('schedules')
  const { data: presentationState } = usePresentationState()
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    item: null,
    position: { x: 0, y: 0 },
  })

  // Track which items are expanded
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    // Start with all items collapsed
    const initial: ExpandedState = {}
    items.forEach((item) => {
      initial[`${item.id}`] = false
    })
    return initial
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Update expanded state when items change
  useEffect(() => {
    setExpanded((prev) => {
      const next: ExpandedState = {}
      items.forEach((item) => {
        // Keep existing state or default to collapsed for new items
        next[`${item.id}`] = prev[`${item.id}`] ?? false
      })
      return next
    })
  }, [items])

  // Expand all items when trigger changes
  useEffect(() => {
    if (expandAllTrigger !== undefined && expandAllTrigger > 0) {
      setExpanded(() => {
        const next: ExpandedState = {}
        items.forEach((item) => {
          next[`${item.id}`] = true
        })
        return next
      })
    }
  }, [expandAllTrigger, items])

  // Collapse all items when trigger changes
  useEffect(() => {
    if (collapseAllTrigger !== undefined && collapseAllTrigger > 0) {
      setExpanded(() => {
        const next: ExpandedState = {}
        items.forEach((item) => {
          next[`${item.id}`] = false
        })
        return next
      })
    }
  }, [collapseAllTrigger, items])

  // Determine what's currently presented - includes scheduleItemIndex for accurate matching
  const presentedInfo = useMemo(() => {
    const temp = presentationState?.temporaryContent
    if (!temp) return null

    // Extract scheduleItemIndex from all content types
    const scheduleItemIndex = temp.data.scheduleItemIndex ?? -1

    if (temp.type === 'song') {
      return {
        type: 'song' as const,
        songId: temp.data.songId,
        slideIndex: temp.data.currentSlideIndex,
        scheduleItemIndex,
      }
    }

    if (temp.type === 'bible_passage') {
      return {
        type: 'bible_passage' as const,
        currentVerseIndex: temp.data.currentVerseIndex,
        scheduleItemIndex,
      }
    }

    if (temp.type === 'versete_tineri') {
      return {
        type: 'versete_tineri' as const,
        currentEntryIndex: temp.data.currentEntryIndex,
        scheduleItemIndex,
      }
    }

    if (temp.type === 'announcement') {
      return {
        type: 'announcement' as const,
        scheduleItemIndex,
      }
    }

    if (temp.type === 'scene') {
      return {
        type: 'scene' as const,
        obsSceneName: temp.data.obsSceneName,
        scheduleItemIndex,
      }
    }

    return null
  }, [presentationState?.temporaryContent])

  // Compute starting flat index for each item - used for accurate sub-item highlighting
  const itemStartFlatIndex = useMemo(() => {
    const map: Record<number, number> = {}
    let flatIndex = 0

    items.forEach((item) => {
      map[item.id] = flatIndex

      if (item.itemType === 'song') {
        const expandedSlides = expandSongSlidesWithChoruses(item.slides)
        flatIndex += expandedSlides.length
      } else if (item.itemType === 'bible_passage') {
        flatIndex += item.biblePassageVerses.length
      } else if (item.itemType === 'slide') {
        if (item.slideType === 'versete_tineri') {
          flatIndex += item.verseteTineriEntries.length
        } else {
          // announcement, scene - single flat item
          flatIndex += 1
        }
      }
    })

    return map
  }, [items])

  // Auto-expand the item when a slide from it is presented
  // Uses scheduleItemIndex to find the exact item being presented
  useEffect(() => {
    if (!presentedInfo || presentedInfo.scheduleItemIndex < 0) return

    // Find the item whose flat index range contains the presented scheduleItemIndex
    const presentedItem = items.find((item) => {
      const startIndex = itemStartFlatIndex[item.id]
      if (startIndex === undefined) return false

      let itemLength = 1
      if (item.itemType === 'song') {
        itemLength = expandSongSlidesWithChoruses(item.slides).length
      } else if (item.itemType === 'bible_passage') {
        itemLength = item.biblePassageVerses.length
      } else if (
        item.itemType === 'slide' &&
        item.slideType === 'versete_tineri'
      ) {
        itemLength = item.verseteTineriEntries.length
      }

      const endIndex = startIndex + itemLength - 1
      return (
        presentedInfo.scheduleItemIndex >= startIndex &&
        presentedInfo.scheduleItemIndex <= endIndex
      )
    })

    if (presentedItem && !expanded[`${presentedItem.id}`]) {
      setExpanded((prev) => ({
        ...prev,
        [`${presentedItem.id}`]: true,
      }))
    }
  }, [presentedInfo, items, expanded, itemStartFlatIndex])

  // Auto-scroll to position the previous slide at the top of the container
  useEffect(() => {
    if (highlightedRef.current && containerRef.current) {
      // Small delay to ensure DOM is ready after auto-expand
      const timeoutId = setTimeout(() => {
        const container = containerRef.current
        const element = highlightedRef.current
        if (!container || !element) return

        // Find the previous element (slide before the highlighted one)
        let previousElement =
          element.previousElementSibling as HTMLElement | null

        // If no previous sibling, find the item header
        // Structure: <item-wrapper><header><expanded-content><slides...>
        if (!previousElement) {
          const expandedContent = element.parentElement
          if (expandedContent) {
            // The header is the previous sibling of expanded content
            previousElement =
              expandedContent.previousElementSibling as HTMLElement
          }
        }

        const containerRect = container.getBoundingClientRect()

        if (previousElement) {
          // Scroll the previous element to the top
          const prevElementRect = previousElement.getBoundingClientRect()
          const elementOffsetFromContainer =
            prevElementRect.top - containerRect.top
          const targetScrollTop =
            container.scrollTop + elementOffsetFromContainer

          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          })
        } else {
          // No previous element (first slide), scroll current to top
          const elementRect = element.getBoundingClientRect()
          const elementOffsetFromContainer = elementRect.top - containerRect.top
          const targetScrollTop =
            container.scrollTop + elementOffsetFromContainer

          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          })
        }
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [presentedInfo])

  const toggleExpanded = useCallback((itemId: number) => {
    setExpanded((prev) => ({
      ...prev,
      [`${itemId}`]: !prev[`${itemId}`],
    }))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id && onReorder) {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(oldIndex, newIndex)
        }
      }
    },
    [items, onReorder],
  )

  // Handle header click - edit song on regular click
  const handleHeaderClick = useCallback(
    (e: React.MouseEvent, item: ScheduleItem) => {
      // Check for middle click (button === 1)
      if (e.button === 1 && item.itemType === 'song' && item.songId) {
        e.preventDefault()
        onNavigateToSong?.(item.songId)
        return
      }

      // Regular click - toggle expand
      toggleExpanded(item.id)
    },
    [toggleExpanded, onNavigateToSong],
  )

  // Handle auxclick (middle click)
  const handleAuxClick = useCallback(
    (e: React.MouseEvent, item: ScheduleItem) => {
      if (e.button === 1 && item.itemType === 'song' && item.songId) {
        e.preventDefault()
        onNavigateToSong?.(item.songId)
      }
    },
    [onNavigateToSong],
  )

  // Handle double click to edit
  const handleDoubleClick = useCallback(
    (item: ScheduleItem) => {
      if (item.itemType === 'song' && item.songId) {
        onEditSong?.(item.songId)
      }
    },
    [onEditSong],
  )

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: ScheduleItem) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({
        item,
        position: { x: e.clientX, y: e.clientY },
      })
    },
    [],
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ item: null, position: { x: 0, y: 0 } })
  }, [])

  const handleEditFromContextMenu = useCallback(
    (item: ScheduleItem) => {
      onEditItem?.(item)
    },
    [onEditItem],
  )

  const handleDeleteFromContextMenu = useCallback(
    (item: ScheduleItem) => {
      onDeleteItem?.(item)
    },
    [onDeleteItem],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-sm">{t('editor.noItems')}</p>
        <p className="text-xs mt-1">{t('editor.addFirstItem')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={containerRef}
            className="flex-1 min-h-0 space-y-2 overflow-hidden lg:overflow-y-auto px-0.5 py-0.5"
          >
            {items.map((item) => {
              const isExpanded = expanded[`${item.id}`] ?? true

              return (
                <SortableItemWrapper
                  key={item.id}
                  item={item}
                  isExpanded={isExpanded}
                  presentedInfo={presentedInfo}
                  itemStartFlatIndex={itemStartFlatIndex[item.id] ?? 0}
                  highlightedRef={highlightedRef}
                  onHeaderClick={handleHeaderClick}
                  onAuxClick={handleAuxClick}
                  onDoubleClick={handleDoubleClick}
                  onContextMenu={handleContextMenu}
                  onSlideClick={onSlideClick}
                  onVerseClick={onVerseClick}
                  onEntryClick={onEntryClick}
                  onAnnouncementClick={onAnnouncementClick}
                  onSceneClick={onSceneClick}
                  onEditSong={onEditSong}
                  onNavigateToSong={onNavigateToSong}
                  t={t}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Context Menu */}
      {contextMenu.item && (
        <ScheduleItemContextMenu
          item={contextMenu.item}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          onEdit={handleEditFromContextMenu}
          onDelete={handleDeleteFromContextMenu}
          onChangeSong={onChangeSong}
        />
      )}
    </div>
  )
}

// Presented info type - includes scheduleItemIndex for accurate matching
type PresentedInfo =
  | {
      type: 'song'
      songId: number
      slideIndex: number
      scheduleItemIndex: number
    }
  | {
      type: 'bible_passage'
      currentVerseIndex: number
      scheduleItemIndex: number
    }
  | {
      type: 'versete_tineri'
      currentEntryIndex: number
      scheduleItemIndex: number
    }
  | { type: 'announcement'; scheduleItemIndex: number }
  | { type: 'scene'; obsSceneName: string; scheduleItemIndex: number }
  | null

// Sortable item wrapper with drag handle
interface SortableItemWrapperProps {
  item: ScheduleItem
  isExpanded: boolean
  presentedInfo: PresentedInfo
  itemStartFlatIndex: number
  highlightedRef: React.RefObject<HTMLButtonElement | null>
  onHeaderClick: (e: React.MouseEvent, item: ScheduleItem) => void
  onAuxClick: (e: React.MouseEvent, item: ScheduleItem) => void
  onDoubleClick: (item: ScheduleItem) => void
  onContextMenu: (e: React.MouseEvent, item: ScheduleItem) => void
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
  onVerseClick: (item: ScheduleItem, verseIndex: number) => void
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
  onAnnouncementClick: (item: ScheduleItem) => void
  onSceneClick?: (item: ScheduleItem) => void
  onEditSong?: (songId: number) => void
  onNavigateToSong?: (songId: number) => void
  t: (key: string) => string
}

function SortableItemWrapper({
  item,
  isExpanded,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onHeaderClick,
  onAuxClick,
  onDoubleClick,
  onContextMenu,
  onSlideClick,
  onVerseClick,
  onEntryClick,
  onAnnouncementClick,
  onSceneClick,
  onEditSong,
  onNavigateToSong,
  t,
}: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Check if item has missing content
  const hasMissingContent =
    (item.itemType === 'song' && item.slides.length === 0) ||
    (item.itemType === 'bible_passage' &&
      item.biblePassageVerses.length === 0) ||
    (item.itemType === 'slide' &&
      item.slideType === 'versete_tineri' &&
      item.verseteTineriEntries.length === 0)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-white dark:bg-gray-800 overflow-hidden ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${
        hasMissingContent
          ? 'border-amber-400 dark:border-amber-500'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Item Header */}
      <div
        className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
        onClick={(e) => onHeaderClick(e, item)}
        onAuxClick={(e) => onAuxClick(e, item)}
        onDoubleClick={() => onDoubleClick(item)}
        onContextMenu={(e) => onContextMenu(e, item)}
      >
        {/* Drag Handle */}
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical
            size={16}
            className="text-gray-400 dark:text-gray-500"
          />
        </div>

        {/* Expand/Collapse Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown
              size={16}
              className="text-gray-400 dark:text-gray-500"
            />
          ) : (
            <ChevronRight
              size={16}
              className="text-gray-400 dark:text-gray-500"
            />
          )}
        </div>

        {/* Item Icon */}
        {item.itemType === 'song' && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Music size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
        )}
        {item.itemType === 'slide' && item.slideType === 'announcement' && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Megaphone
              size={16}
              className="text-orange-600 dark:text-orange-400"
            />
          </div>
        )}
        {item.itemType === 'slide' && item.slideType === 'versete_tineri' && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <User size={16} className="text-green-600 dark:text-green-400" />
          </div>
        )}
        {item.itemType === 'bible_passage' && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <Book size={16} className="text-teal-600 dark:text-teal-400" />
          </div>
        )}
        {item.itemType === 'slide' && item.slideType === 'scene' && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Camera
              size={16}
              className="text-violet-600 dark:text-violet-400"
            />
          </div>
        )}

        {/* Item Title & Info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="font-medium text-sm truncate text-gray-900 dark:text-white">
            {item.itemType === 'song' && item.song?.title}
            {item.itemType === 'slide' &&
              item.slideType === 'announcement' &&
              t('presenter.announcement')}
            {item.itemType === 'slide' &&
              item.slideType === 'versete_tineri' &&
              t('presenter.verseteTineri')}
            {item.itemType === 'slide' &&
              item.slideType === 'scene' &&
              (item.slideContent || item.obsSceneName)}
            {item.itemType === 'bible_passage' && (
              <span className="flex items-center gap-1">
                {item.biblePassageReference}
                {item.biblePassageVerses.length === 0 && (
                  <AlertTriangle
                    size={12}
                    className="text-amber-500 flex-shrink-0"
                    title={t('warnings.invalidReference')}
                  />
                )}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {item.itemType === 'song' && (
              <>
                {item.slides.length} slides
                {item.song?.categoryName && ` • ${item.song.categoryName}`}
              </>
            )}
            {item.itemType === 'bible_passage' && (
              <>
                {item.biblePassageVerses.length} verses •{' '}
                {item.biblePassageTranslation}
              </>
            )}
            {item.itemType === 'slide' &&
              item.slideType === 'versete_tineri' && (
                <>{item.verseteTineriEntries.length} entries</>
              )}
            {item.itemType === 'slide' &&
              item.slideType === 'scene' &&
              item.obsSceneName &&
              item.slideContent !== item.obsSceneName && (
                <>{item.obsSceneName}</>
              )}
            {item.itemType === 'slide' &&
              item.slideType === 'scene' &&
              (!item.obsSceneName ||
                item.slideContent === item.obsSceneName) && (
                <>{t('slideTemplates.scene')}</>
              )}
          </div>
        </div>

        {/* Warning indicator for missing content */}
        {hasMissingContent && (
          <div
            className="flex-shrink-0 p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30"
            title={t('warnings.missingContent')}
          >
            <AlertTriangle
              size={16}
              className="text-amber-600 dark:text-amber-400"
            />
          </div>
        )}

        {/* Edit Button for Songs */}
        {item.itemType === 'song' && item.songId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEditSong?.(item.songId!)
            }}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                e.stopPropagation()
                onNavigateToSong?.(item.songId!)
              }
            }}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={t('presenter.editSong')}
          >
            <Eye
              size={16}
              className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            />
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          {/* Song Slides */}
          {item.itemType === 'song' && (
            <SongSlides
              item={item}
              presentedInfo={presentedInfo}
              itemStartFlatIndex={itemStartFlatIndex}
              highlightedRef={highlightedRef}
              onSlideClick={onSlideClick}
            />
          )}

          {/* Bible Passage Verses */}
          {item.itemType === 'bible_passage' && (
            <BiblePassageVerses
              item={item}
              presentedInfo={presentedInfo}
              itemStartFlatIndex={itemStartFlatIndex}
              highlightedRef={highlightedRef}
              onVerseClick={onVerseClick}
            />
          )}

          {/* Versete Tineri Entries */}
          {item.itemType === 'slide' && item.slideType === 'versete_tineri' && (
            <VerseteTineriEntries
              item={item}
              presentedInfo={presentedInfo}
              itemStartFlatIndex={itemStartFlatIndex}
              highlightedRef={highlightedRef}
              onEntryClick={onEntryClick}
            />
          )}

          {/* Announcement Slide */}
          {item.itemType === 'slide' && item.slideType === 'announcement' && (
            <AnnouncementSlide
              item={item}
              presentedInfo={presentedInfo}
              highlightedRef={highlightedRef}
              onAnnouncementClick={onAnnouncementClick}
            />
          )}

          {/* Scene Slide */}
          {item.itemType === 'slide' && item.slideType === 'scene' && (
            <SceneSlide
              item={item}
              presentedInfo={presentedInfo}
              highlightedRef={highlightedRef}
              onSceneClick={onSceneClick}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Song Slides sub-component
interface SongSlidesProps {
  item: ScheduleItem
  presentedInfo: PresentedInfo
  itemStartFlatIndex: number
  highlightedRef: React.RefObject<HTMLButtonElement | null>
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
}

function SongSlides({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onSlideClick,
}: SongSlidesProps) {
  const { t } = useTranslation('schedules')

  // Expand slides with dynamic chorus insertion
  const expandedSlides = useMemo(
    () => expandSongSlidesWithChoruses(item.slides),
    [item.slides],
  )

  // Empty state for songs with no slides
  if (expandedSlides.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
        <AlertTriangle
          size={16}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0"
        />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          {t('warnings.noSlides')}
        </span>
      </div>
    )
  }

  return (
    <>
      {expandedSlides.map((slide, index) => {
        // Use scheduleItemIndex for accurate matching - only highlight if this specific slide is presented
        const isPresented =
          presentedInfo?.type === 'song' &&
          presentedInfo.scheduleItemIndex === itemStartFlatIndex + index

        const plainText = stripHtmlTags(slide.content)

        return (
          <button
            key={`${slide.id}-${index}`}
            ref={isPresented ? highlightedRef : null}
            type="button"
            onClick={() => onSlideClick(item, index)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              isPresented
                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`font-semibold text-sm min-w-[24px] ${
                  isPresented
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`text-sm whitespace-pre-line line-clamp-3 ${
                  isPresented
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {plainText}
              </span>
            </div>
            {slide.label && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-8 mt-1 block">
                {slide.label}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

// Bible Passage Verses sub-component
interface BiblePassageVersesProps {
  item: ScheduleItem
  presentedInfo: PresentedInfo
  itemStartFlatIndex: number
  highlightedRef: React.RefObject<HTMLButtonElement | null>
  onVerseClick: (item: ScheduleItem, verseIndex: number) => void
}

function BiblePassageVerses({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onVerseClick,
}: BiblePassageVersesProps) {
  const { t } = useTranslation('schedules')

  // Empty state for bible passages with no verses
  if (item.biblePassageVerses.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
        <AlertTriangle
          size={16}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0"
        />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          {t('warnings.noVerses')}
        </span>
      </div>
    )
  }

  return (
    <>
      {item.biblePassageVerses.map((verse, index) => {
        // Use scheduleItemIndex for accurate matching - only highlight if this specific verse is presented
        const isPresented =
          presentedInfo?.type === 'bible_passage' &&
          presentedInfo.scheduleItemIndex === itemStartFlatIndex + index

        return (
          <button
            key={verse.id}
            ref={isPresented ? highlightedRef : null}
            type="button"
            onClick={() => onVerseClick(item, index)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              isPresented
                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`font-semibold text-sm min-w-[24px] ${
                  isPresented
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs font-medium ${
                    isPresented
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {verse.reference}
                </span>
                <span
                  className={`text-sm line-clamp-2 block ${
                    isPresented
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {verse.text}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </>
  )
}

// Versete Tineri Entries sub-component
interface VerseteTineriEntriesProps {
  item: ScheduleItem
  presentedInfo: PresentedInfo
  itemStartFlatIndex: number
  highlightedRef: React.RefObject<HTMLButtonElement | null>
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
}

function VerseteTineriEntries({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onEntryClick,
}: VerseteTineriEntriesProps) {
  const { t } = useTranslation('schedules')

  // Empty state for versete tineri with no entries
  if (item.verseteTineriEntries.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
        <AlertTriangle
          size={16}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0"
        />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          {t('warnings.noEntries')}
        </span>
      </div>
    )
  }

  return (
    <>
      {item.verseteTineriEntries.map((entry, index) => {
        // Use scheduleItemIndex for accurate matching - only highlight if this specific entry is presented
        const isPresented =
          presentedInfo?.type === 'versete_tineri' &&
          presentedInfo.scheduleItemIndex === itemStartFlatIndex + index

        return (
          <button
            key={entry.id}
            ref={isPresented ? highlightedRef : null}
            type="button"
            onClick={() => onEntryClick(item, index)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              isPresented
                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`font-semibold text-sm min-w-[24px] ${
                  isPresented
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User
                    size={12}
                    className={
                      isPresented
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400'
                    }
                  />
                  <span
                    className={`text-xs font-medium ${
                      isPresented
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {entry.personName}
                  </span>
                </div>
                <span
                  className={`text-xs flex items-center gap-1 ${
                    isPresented
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {entry.reference}
                  {!entry.text && (
                    <AlertTriangle
                      size={10}
                      className="text-amber-500 flex-shrink-0"
                      title={t('warnings.invalidReference')}
                    />
                  )}
                </span>
                <span
                  className={`text-sm line-clamp-2 block ${
                    isPresented
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {entry.text}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </>
  )
}

// Announcement Slide sub-component
interface AnnouncementSlideProps {
  item: ScheduleItem
  presentedInfo: PresentedInfo
  highlightedRef: React.RefObject<HTMLButtonElement | null>
  onAnnouncementClick: (item: ScheduleItem) => void
}

function AnnouncementSlide({
  item,
  presentedInfo,
  highlightedRef,
  onAnnouncementClick,
}: AnnouncementSlideProps) {
  const plainText = stripHtmlTags(item.slideContent || '')
  const isPresented = presentedInfo?.type === 'announcement'

  return (
    <button
      ref={isPresented ? highlightedRef : null}
      type="button"
      onClick={() => onAnnouncementClick(item)}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isPresented
          ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <FileText
          size={16}
          className={`flex-shrink-0 mt-0.5 ${
            isPresented ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
          }`}
        />
        <span
          className={`text-sm line-clamp-3 ${
            isPresented
              ? 'text-green-900 dark:text-green-100'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {plainText}
        </span>
      </div>
    </button>
  )
}

// Scene Slide sub-component
interface SceneSlideProps {
  item: ScheduleItem
  presentedInfo: PresentedInfo
  highlightedRef: React.RefObject<HTMLButtonElement | null>
  onSceneClick?: (item: ScheduleItem) => void
}

function SceneSlide({
  item,
  presentedInfo,
  highlightedRef,
  onSceneClick,
}: SceneSlideProps) {
  const { t } = useTranslation('schedules')
  const isPresented =
    presentedInfo?.type === 'scene' &&
    presentedInfo.obsSceneName === item.obsSceneName

  return (
    <button
      ref={isPresented ? highlightedRef : null}
      type="button"
      onClick={() => onSceneClick?.(item)}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isPresented
          ? 'bg-violet-100 dark:bg-violet-900/50 ring-2 ring-violet-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <Camera
          size={16}
          className={`flex-shrink-0 ${
            isPresented
              ? 'text-violet-600 dark:text-violet-400'
              : 'text-gray-400'
          }`}
        />
        <span
          className={`text-sm ${
            isPresented
              ? 'text-violet-900 dark:text-violet-100'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {t('slideTemplates.scene')}: {item.slideContent || item.obsSceneName}
        </span>
      </div>
    </button>
  )
}
