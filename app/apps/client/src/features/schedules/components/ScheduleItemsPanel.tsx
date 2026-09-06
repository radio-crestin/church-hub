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
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  MoreVertical,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentationState } from '~/features/presentation'
import { ScheduleItemContextMenu } from './ScheduleItemContextMenu'
import { ScheduleItemSubItems } from './ScheduleItemSubItems'
import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { ScheduleSungToggle } from './ScheduleSungToggle'
import { useScheduleItemExpansion } from '../hooks/useScheduleItemExpansion'
import type { ScheduleItem } from '../types'
import {
  derivePresentedScheduleInfo,
  type PresentedScheduleInfo,
} from '../utils/presentedScheduleInfo'
import { buildItemStartFlatIndex } from '../utils/scheduleFlatItems'

interface ScheduleItemsPanelProps {
  scheduleId: number
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
  onEditKeyLine?: (item: ScheduleItem) => void
  /** Flips an item's done-marker. Every kind carries one. */
  onToggleSung?: (item: ScheduleItem) => void
  expandAllTrigger?: number
  collapseAllTrigger?: number
}

interface ContextMenuState {
  item: ScheduleItem | null
  position: { x: number; y: number }
}

export function ScheduleItemsPanel({
  scheduleId,
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
  onEditKeyLine,
  onToggleSung,
  expandAllTrigger,
  collapseAllTrigger,
}: ScheduleItemsPanelProps) {
  const { t } = useTranslation('schedules')
  const { data: presentationState } = usePresentationState()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    item: null,
    position: { x: 0, y: 0 },
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

  // Only content *this* program put on the projector belongs in this list.
  const presentedInfo = useMemo(() => {
    const info = derivePresentedScheduleInfo(
      presentationState?.temporaryContent,
    )
    return info && info.scheduleId === scheduleId ? info : null
  }, [presentationState?.temporaryContent, scheduleId])

  const itemStartFlatIndex = useMemo(
    () => buildItemStartFlatIndex(items),
    [items],
  )

  const { isExpanded, toggleExpanded, highlightedRef, containerRef } =
    useScheduleItemExpansion({
      storageKey: `schedule-items-expanded-${scheduleId}`,
      items,
      presentedInfo,
      itemStartFlatIndex,
      expandAllTrigger,
      collapseAllTrigger,
    })

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
            className="flex-1 min-h-0 space-y-2 overflow-hidden lg:overflow-y-auto p-1"
          >
            {items.map((item) => (
              <SortableItemWrapper
                key={item.id}
                item={item}
                isExpanded={isExpanded(item.id)}
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
                onToggleSung={onToggleSung}
                t={t}
              />
            ))}
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
          onEditKeyLine={onEditKeyLine}
        />
      )}
    </div>
  )
}

// Sortable item wrapper with drag handle
interface SortableItemWrapperProps {
  item: ScheduleItem
  isExpanded: boolean
  presentedInfo: PresentedScheduleInfo | null
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
  onToggleSung?: (item: ScheduleItem) => void
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
  onToggleSung,
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

        {/* Done-marker — every kind of item can be ticked off a program. */}
        {onToggleSung ? (
          <ScheduleSungToggle
            isSung={item.isSung}
            onToggle={() => onToggleSung(item)}
            variant={item.itemType === 'bible_passage' ? 'read' : 'sung'}
            testId="schedule-item-sung-toggle"
          />
        ) : null}

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

        <ScheduleItemTypeIcon item={item} />

        {/* Item Title & Info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="font-medium text-sm truncate text-gray-900 dark:text-white">
            {item.itemType === 'song' && item.song?.title}
            {item.itemType === 'slide' &&
              item.slideType === 'announcement' &&
              t('presenter.announcement')}
            {item.itemType === 'slide' &&
              item.slideType === 'versete_tineri' &&
              (!isExpanded && item.verseteTineriEntries.length > 0
                ? item.verseteTineriEntries
                    .map((e) => `${e.personName} – ${e.reference}`)
                    .join(', ')
                : t('presenter.verseteTineri'))}
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
                    aria-label={t('warnings.invalidReference')}
                  />
                )}
              </span>
            )}
          </div>
          {/* Song rows deliberately carry no second line: the title plus the
              slides underneath is the whole story while running a program. */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
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

        {/* Options Menu Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onContextMenu(e, item)
          }}
          className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={t('common.options')}
        >
          <MoreVertical
            size={16}
            className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          />
        </button>
      </div>

      {/* Expanded Content — the item's presentable steps */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-1">
          <ScheduleItemSubItems
            item={item}
            presentedInfo={presentedInfo}
            itemStartFlatIndex={itemStartFlatIndex}
            highlightedRef={highlightedRef}
            onSlideClick={onSlideClick}
            onVerseClick={onVerseClick}
            onEntryClick={onEntryClick}
            onAnnouncementClick={onAnnouncementClick}
            onSceneClick={onSceneClick}
          />
        </div>
      )}
    </div>
  )
}
