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
import type { TFunction } from 'i18next'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  MoreVertical,
} from 'lucide-react'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentationState } from '~/features/presentation'
import { ScheduleItemAdvance } from './ScheduleItemAdvance'
import { ScheduleItemContextMenu } from './ScheduleItemContextMenu'
import { ScheduleItemMidi } from './ScheduleItemMidi'
import { ScheduleItemSubItems } from './ScheduleItemSubItems'
import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { ScheduleKeyLineChip } from './ScheduleKeyLineChip'
import { ScheduleQuickInsertBar } from './ScheduleQuickInsertBar'
import { ScheduleSungToggle } from './ScheduleSungToggle'
import { useScheduleItemExpansion } from '../hooks/useScheduleItemExpansion'
import { useMediaItemText } from '../media-items/hooks/useMediaItemText'
import { isBackgroundVideo } from '../media-items/isBackgroundVideo'
import type { ScheduleItem } from '../types'
import { itemStepSeconds } from '../utils/itemStepSeconds'
import {
  derivePresentedScheduleInfo,
  type PresentedScheduleInfo,
} from '../utils/presentedScheduleInfo'
import { buildItemStartFlatIndex } from '../utils/scheduleFlatItems'
import { scheduleItemShortTitle } from '../utils/scheduleItemShortTitle'
import type { AutoplayTiming } from '../utils/stepSeconds'

interface ScheduleItemsPanelProps {
  scheduleId: number
  items: ScheduleItem[]
  isLoading: boolean
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
  onVerseClick: (item: ScheduleItem, verseIndex: number) => void
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
  onAnnouncementClick: (item: ScheduleItem) => void
  onSceneClick?: (item: ScheduleItem) => void
  onVideoClick?: (item: ScheduleItem) => void
  onReorder?: (oldIndex: number, newIndex: number) => void
  onEditSong?: (songId: number) => void
  onNavigateToSong?: (songId: number) => void
  onDeleteItem?: (item: ScheduleItem) => void
  onEditItem?: (item: ScheduleItem) => void
  onChangeSong?: (item: ScheduleItem) => void
  onEditKeyLine?: (item: ScheduleItem) => void
  /** Flips an item's done-marker. Every kind carries one. */
  onToggleSung?: (item: ScheduleItem) => void
  /** Inserts right after an entry, from the bar between entries; absent hides the bar. */
  onQuickInsert?: (afterItemId: number) => void
  /** The item picked as where the next Down/Up starts, outlined in the list. */
  selectedItemId?: number | null
  /** A click on an item's header picks it as where Down/Up go next. */
  onSelectItem?: (item: ScheduleItem) => void
  /**
   * While autoplay is on: each item shows how long its slides stay up, and
   * can be given its own time. Absent hides it.
   */
  itemAdvance?: ItemAdvance
  /**
   * The presentation whose song items show their MIDI music and can be given
   * one (editors only). Absent hides it.
   */
  midiScheduleId?: number
  expandAllTrigger?: number
  collapseAllTrigger?: number
  /**
   * Follow and present only, as in the control room's playlist: no dragging,
   * no edit menu, and the list scrolls on its own so it can follow the live
   * step inside a longer page.
   */
  readOnly?: boolean
}

interface ItemAdvance {
  timing: AutoplayTiming
  onChange: (item: ScheduleItem, advanceSeconds: number | null) => void
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
  onVideoClick,
  onReorder,
  onEditSong,
  onNavigateToSong,
  onDeleteItem,
  onEditItem,
  onChangeSong,
  onEditKeyLine,
  onToggleSung,
  onQuickInsert,
  selectedItemId = null,
  onSelectItem,
  itemAdvance,
  midiScheduleId,
  expandAllTrigger,
  collapseAllTrigger,
  readOnly = false,
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

      // Regular click - toggle expand, and start Down/Up from this item
      toggleExpanded(item.id)
      onSelectItem?.(item)
    },
    [toggleExpanded, onNavigateToSong, onSelectItem],
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
            className={`flex-1 min-h-0 space-y-2 p-1 ${
              readOnly
                ? 'max-h-[60vh] overflow-y-auto'
                : 'overflow-hidden lg:overflow-y-auto'
            }`}
          >
            {items.map((item, index) => (
              <Fragment key={item.id}>
                <SortableItemWrapper
                  item={item}
                  isExpanded={isExpanded(item.id)}
                  isSelected={item.id === selectedItemId}
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
                  onVideoClick={onVideoClick}
                  onToggleSung={onToggleSung}
                  onEditKeyLine={onEditKeyLine}
                  itemAdvance={itemAdvance}
                  midiScheduleId={midiScheduleId}
                  readOnly={readOnly}
                  t={t}
                />
                {onQuickInsert && index < items.length - 1 ? (
                  <ScheduleQuickInsertBar
                    afterTitle={scheduleItemShortTitle(item)}
                    onInsert={() => onQuickInsert(item.id)}
                  />
                ) : null}
              </Fragment>
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
  isSelected: boolean
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
  onVideoClick?: (item: ScheduleItem) => void
  onToggleSung?: (item: ScheduleItem) => void
  onEditKeyLine?: (item: ScheduleItem) => void
  itemAdvance?: ItemAdvance
  midiScheduleId?: number
  readOnly: boolean
  t: TFunction
}

function SortableItemWrapper({
  item,
  isExpanded,
  isSelected,
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
  onVideoClick,
  onToggleSung,
  onEditKeyLine,
  itemAdvance,
  midiScheduleId,
  readOnly,
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

  const mediaText = useMediaItemText(item)
  // Check if item has missing content
  const hasMissingContent =
    (item.itemType === 'verses' && item.verseteTineriEntries.length === 0) ||
    (item.itemType === 'video' && !item.video) ||
    (item.itemType === 'music' && !item.music?.trackCount) ||
    (item.itemType === 'song' && item.slides.length === 0) ||
    (item.itemType === 'bible_passage' &&
      item.biblePassageVerses.length === 0) ||
    (item.itemType === 'slide' &&
      item.slideType === 'versete_tineri' &&
      item.verseteTineriEntries.length === 0)

  return (
    <div
      ref={setNodeRef}
      data-testid="schedule-item"
      data-selected={isSelected || undefined}
      style={style}
      className={`rounded-lg border bg-white dark:bg-gray-800 overflow-hidden ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${
        hasMissingContent
          ? 'border-amber-400 dark:border-amber-500'
          : 'border-gray-200 dark:border-gray-700'
      } ${isSelected ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}`}
    >
      {/* Item Header */}
      <div
        className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
        onClick={(e) => onHeaderClick(e, item)}
        onAuxClick={(e) => onAuxClick(e, item)}
        onDoubleClick={readOnly ? undefined : () => onDoubleClick(item)}
        onContextMenu={readOnly ? undefined : (e) => onContextMenu(e, item)}
      >
        {/* Drag Handle */}
        {!readOnly && (
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
        )}

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
          <div className="font-medium text-sm sm:truncate text-gray-900 dark:text-white">
            {item.itemType === 'song' && (
              <span className="flex min-w-0 items-center gap-2">
                {/* A phone has no room for one line: the title takes two. */}
                <span className="line-clamp-2 break-words sm:truncate">
                  {item.song?.title}
                </span>
                <ScheduleKeyLineChip
                  keyLine={item.keyLine}
                  onEdit={onEditKeyLine ? () => onEditKeyLine(item) : undefined}
                  testId="schedule-item-key-line"
                />
              </span>
            )}
            {mediaText?.title}
            {item.itemType === 'slide' &&
              item.slideType === 'announcement' &&
              t('presenter.announcement')}
            {item.itemType === 'slide' &&
              item.slideType === 'versete_tineri' &&
              (!isExpanded && item.verseteTineriEntries.length > 0
                ? item.verseteTineriEntries
                    // A reading with nobody attached shows just its reference,
                    // not a dangling dash — the name is optional.
                    .map((e) =>
                      e.personName.trim()
                        ? `${e.personName} – ${e.reference}`
                        : e.reference,
                    )
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
          {/* Song rows deliberately carry no second line: the title, its gama
              and the slides underneath are the whole story while running a
              program. */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {mediaText?.detail}
            {item.itemType === 'bible_passage' && (
              <>
                {t('presenter.versesCount', {
                  count: item.biblePassageVerses.length,
                })}{' '}
                • {item.biblePassageTranslation}
              </>
            )}
            {item.itemType === 'slide' &&
              item.slideType === 'versete_tineri' && (
                <>
                  {t('verseteTineri.entriesCount', {
                    count: item.verseteTineriEntries.length,
                  })}
                </>
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

        {midiScheduleId !== undefined && item.itemType === 'song' && (
          <ScheduleItemMidi scheduleId={midiScheduleId} item={item} />
        )}

        {/* Music shows nothing, so it has no time on screen; a MIDI item's
            slides follow its music, not a time per slide. */}
        {itemAdvance &&
          item.itemType !== 'music' &&
          !isBackgroundVideo(item) &&
          !item.midi && (
            <ScheduleItemAdvance
              advanceSeconds={item.advanceSeconds}
              defaultSeconds={itemStepSeconds(
                { ...item, advanceSeconds: null },
                itemAdvance.timing,
              )}
              onChange={(seconds) => itemAdvance.onChange(item, seconds)}
            />
          )}

        {/* Options Menu Button */}
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu(e, item)
            }}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={t('common:options')}
            aria-label={t('common:options')}
            data-testid="schedule-item-options"
          >
            <MoreVertical
              size={16}
              className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            />
          </button>
        )}
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
            onVideoClick={onVideoClick}
          />
        </div>
      )}
    </div>
  )
}
