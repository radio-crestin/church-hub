import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ExternalLink,
  Search,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSongDropZone } from '~/features/songs/hooks/useSongDropZone'
import { useFollowPresentedScroll } from '~/hooks/useFollowPresentedScroll'
import { usePermissions } from '~/provider/permissions-provider'
import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { ConfirmModal } from '~/ui/modal'
import { ClearSearchButton } from '~/ui/search'
import { useToast } from '~/ui/toast'
import { normalizeForSearch } from '~/utils/normalizeForSearch'
import {
  ScheduleItemEditors,
  type ScheduleItemEditorsHandle,
} from './ScheduleItemEditors'
import { ScheduleSlideRow } from './ScheduleSlideRow'
import { ScheduleSongRow } from './ScheduleSongRow'
import { ScheduleVerseRow } from './ScheduleVerseRow'
import {
  useAddItemToSchedule,
  useDeleteSchedule,
  useMarkScheduleItemSung,
  useRemoveItemFromSchedule,
  useReorderScheduleItems,
  useSchedule,
  useScheduleFlatNavigation,
  useSchedules,
} from '../hooks'
import {
  readSelectedScheduleId,
  writeSelectedScheduleId,
} from '../service/selectedSchedule'
import type { AddToScheduleInput, ScheduleItem } from '../types'
import { countScheduleItemSteps } from '../utils/scheduleFlatItems'

interface SchedulePanelProps {
  /**
   * Which item kind this panel is primarily about. The song page lists songs,
   * the Bible page lists passages; each can opt into showing the other.
   */
  variant?: 'songs' | 'verses'
  /** Highlights the song currently open on the song page. */
  activeSongId?: number
  /** Highlights the passage currently open on the Bible page. */
  activeReference?: string | null
  onSelectSong?: (songId: number) => void
  /**
   * Fires after a song row projects its first slide. The song list uses it to
   * follow the projector onto that song's page, so the operator lands on the
   * slide rail instead of being left on the list with the program running.
   * Deliberately separate from `onSelectSong`: the Bible page shares this
   * panel and must stay put when a row is clicked.
   */
  onSongPresented?: (songId: number) => void
  /** Opens a passage on the Bible page at its exact verse. */
  onSelectPassage?: (item: ScheduleItem) => void
  /** Opens the full program page. */
  onOpenSchedule?: (scheduleId: number) => void
  /**
   * The song the page currently has in focus — the open song on the song page,
   * the highlighted row on the search page. The header's "+" adds this one.
   */
  candidateSong?: { id: number; title: string } | null
  /** The passage the Bible page has in focus — what the header's "+" adds. */
  candidatePassage?:
    | (NonNullable<AddToScheduleInput['biblePassage']> & { label: string })
    | null
  /** Accepts songs dragged in from the song list. */
  acceptsSongDrop?: boolean
  /**
   * Bulk-adds every bookmarked song to a program. Lives here rather than in the
   * Marcaje header because it is a program action, not a bookmark one.
   */
  onAddAllBookmarks?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

/**
 * The "Programe" section on the song and Bible pages: pick one of the
 * operator's programs and run it from right there, without walking over to the
 * program page.
 *
 * It is the program page's item list in miniature — every kind of item shows
 * up, each expands to its presentable steps, clicking a step projects it, and
 * the live step is ringed green — wrapped in the panel affordances the two
 * pages already had: the sung/read markers, the all/remaining/sung tabs, the
 * search box, drag-to-reorder, and the add/open/delete buttons.
 *
 * Reordering and filtering deliberately stay a songs-and-passages affair: an
 * announcement has no "already sung" state and its place in the program is the
 * program editor's business, so those rows ride along at their fixed positions.
 */
export function SchedulePanel({
  // Songs vs verses only steered the header's green one-click add, which is
  // gone; kept until it is decided whether the distinction comes back.
  variant = 'songs',
  activeSongId,
  activeReference = null,
  onSelectSong,
  onSongPresented,
  onSelectPassage,
  onOpenSchedule,
  // Left in place while the header's green one-click add is gone: the prop is
  // still passed by every host, and whether it comes back is not this
  // component's call.
  candidateSong = null,
  candidatePassage = null,
  acceptsSongDrop = false,
  onAddAllBookmarks,
  isCollapsed = false,
  onToggleCollapse,
}: SchedulePanelProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  // Adding and editing rewrite the program itself, so they follow the same
  // permission the program page's own editors do.
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canEditProgram = hasPermission('programs.edit')
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedules()
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    readSelectedScheduleId,
  )
  const [searchQuery, setSearchQuery] = useState('')
  // The search box is a drawer behind the header's magnifier: the panel is
  // narrow and the program list is what the operator came for.
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Scroll anchors for whichever row the projector is inside.
  const liveRowRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // The program page's own add/edit dialogs, borrowed by this panel.
  const editorsRef = useRef<ScheduleItemEditorsHandle>(null)

  const removeItemMutation = useRemoveItemFromSchedule()
  const markSungMutation = useMarkScheduleItemSung()
  const reorderItemsMutation = useReorderScheduleItems()
  const addItemMutation = useAddItemToSchedule()
  const deleteScheduleMutation = useDeleteSchedule()
  const [pendingDelete, setPendingDelete] = useState(false)
  // Local order override so a drag lands instantly instead of waiting for the
  // refetch — cleared as soon as server data catches up.
  const [localOrder, setLocalOrder] = useState<ScheduleItem[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Default to the most recently updated program the first time the panel is
  // used, and recover if the remembered one was deleted elsewhere.
  useEffect(() => {
    // Wait for the real list: an empty one while loading is not an answer.
    if (schedulesLoading) return
    if (schedules.length === 0) {
      // The last program is gone (or there never was one) — drop the
      // remembered id so the header stops offering actions on it.
      if (selectedScheduleId !== null) setSelectedScheduleId(null)
      return
    }
    const stillExists = schedules.some((s) => s.id === selectedScheduleId)
    if (!stillExists) {
      setSelectedScheduleId(schedules[0]?.id ?? null)
    }
  }, [schedules, schedulesLoading, selectedScheduleId])

  useEffect(() => {
    // Persisted through the shared store so the page around this panel — whose
    // next/prev has to know which program is live — hears about it at once.
    writeSelectedScheduleId(selectedScheduleId)
  }, [selectedScheduleId])

  // Focus the search field the moment its drawer opens.
  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  const { data: schedule, isLoading: scheduleLoading } = useSchedule(
    selectedScheduleId ?? undefined,
  )

  const allItems = useMemo(() => schedule?.items ?? [], [schedule?.items])

  // Presenting from this panel goes through the same flat run the program page
  // walks, so the cursor and the "what's next" preview match exactly.
  const {
    itemStartFlatIndex,
    presentedInfo,
    isScheduleLive,
    presentSongSlide,
    presentPassageVerse,
    presentVerseteEntry,
    presentAnnouncement,
    presentScene,
  } = useScheduleFlatNavigation({
    scheduleId: selectedScheduleId,
    items: allItems,
  })

  const panelPresentedInfo = isScheduleLive ? presentedInfo : null

  const scheduleOptions = useMemo<ComboboxOption[]>(
    () =>
      schedules.map((s) => ({
        value: s.id,
        label: s.title,
        details: [
          {
            label: t('panel.songCount', { count: s.songCount ?? 0 }),
            variant: 'info' as const,
          },
        ],
      })),
    [schedules, t],
  )

  // The whole program is listed, and the whole program reorders: a service is
  // one running order, so an announcement moves between two songs exactly the
  // way a song moves between two announcements.
  const orderedItems = localOrder ?? allItems

  useEffect(() => {
    setLocalOrder(null)
  }, [allItems])

  const isSearching = searchQuery.trim().length > 0

  const displayItems = useMemo(() => {
    // Folded on both sides so "cantare" finds "cântare" and vice versa.
    const q = normalizeForSearch(searchQuery.trim())
    if (!q) return orderedItems
    return orderedItems.filter((item) => {
      if (item.itemType === 'bible_passage') {
        return (
          normalizeForSearch(item.biblePassageReference ?? '').includes(q) ||
          item.biblePassageVerses.some((verse) =>
            normalizeForSearch(verse.text).includes(q),
          )
        )
      }
      if (item.itemType === 'slide') {
        return (
          normalizeForSearch(item.slideContent ?? '').includes(q) ||
          normalizeForSearch(item.obsSceneName ?? '').includes(q) ||
          item.verseteTineriEntries.some(
            (entry) =>
              normalizeForSearch(entry.personName).includes(q) ||
              normalizeForSearch(entry.reference).includes(q),
          )
        )
      }
      return (
        normalizeForSearch(item.song?.title ?? '').includes(q) ||
        normalizeForSearch(item.song?.categoryName ?? '').includes(q) ||
        normalizeForSearch(item.keyLine ?? '').includes(q) ||
        item.song?.tagNames?.some((name) =>
          normalizeForSearch(name).includes(q),
        )
      )
    })
  }, [orderedItems, searchQuery])

  /** The program item the projector is inside right now, if any. */
  const liveItemId = useMemo(() => {
    if (!panelPresentedInfo || panelPresentedInfo.scheduleItemIndex < 0) {
      return null
    }
    const found = allItems.find((item) => {
      const start = itemStartFlatIndex[item.id]
      if (start === undefined) return false
      const end = start + countScheduleItemSteps(item) - 1
      return (
        panelPresentedInfo.scheduleItemIndex >= start &&
        panelPresentedInfo.scheduleItemIndex <= end
      )
    })
    return found?.id ?? null
  }, [allItems, itemStartFlatIndex, panelPresentedInfo])

  // Keep the live row — and the one after it — in view as the program moves on.
  useFollowPresentedScroll(
    listRef,
    liveRowRef,
    panelPresentedInfo?.scheduleItemIndex ?? -1,
  )

  /**
   * Puts a program item on screen from its FIRST step. Which verse or slide
   * within it goes up next is chosen on the left of the page, or with the
   * next/prev arrows — this list is the running order, not a verse picker.
   */
  const presentItem = useCallback(
    (item: ScheduleItem) => {
      if (item.itemType === 'song') {
        const presented = presentSongSlide(item, 0)
        // The projector already carries this program's id, so the song page
        // derives schedule mode on arrival — nothing else has to be handed over.
        if (item.songId) onSongPresented?.(item.songId)
        return presented
      }
      if (item.itemType === 'bible_passage') return presentPassageVerse(item, 0)
      if (item.slideType === 'versete_tineri') {
        return presentVerseteEntry(item, 0)
      }
      if (item.slideType === 'scene') return presentScene(item)
      return presentAnnouncement(item)
    },
    [
      onSongPresented,
      presentAnnouncement,
      presentPassageVerse,
      presentScene,
      presentSongSlide,
      presentVerseteEntry,
    ],
  )

  const handleToggleSung = useCallback(
    (itemId: number, isSung: boolean) => {
      if (!selectedScheduleId) return
      markSungMutation.mutate({
        scheduleId: selectedScheduleId,
        itemId,
        isSung: !isSung,
      })
    },
    [selectedScheduleId, markSungMutation],
  )

  const handleRemove = useCallback(
    (itemId: number) => {
      if (!selectedScheduleId) return
      removeItemMutation.mutate({ scheduleId: selectedScheduleId, itemId })
    },
    [selectedScheduleId, removeItemMutation],
  )

  /**
   * Appends a song to the selected program. Duplicates are allowed on purpose:
   * a service often opens and closes with the same song.
   */
  const addSongToSelected = useCallback(
    (song: { id: number; title: string }) => {
      if (!selectedScheduleId) {
        showToast(t('panel.selectScheduleFirst'), 'error')
        return
      }
      addItemMutation.mutate(
        { scheduleId: selectedScheduleId, input: { songId: song.id } },
        {
          onSuccess: () =>
            showToast(t('panel.songAdded', { title: song.title }), 'success'),
          onError: () => showToast(t('messages.error'), 'error'),
        },
      )
    },
    [selectedScheduleId, addItemMutation, showToast, t],
  )

  /**
   * Appends the Bible page's current passage to the selected program. Nothing
   * calls this since the header's green one-click add was removed; it is kept
   * rather than deleted until that is deliberately decided.
   */
  // biome-ignore lint/correctness/noUnusedVariables: kept pending a decision on the removed quick-add
  const addPassageToSelected = useCallback(() => {
    if (!selectedScheduleId || !candidatePassage) {
      showToast(t('panel.selectScheduleFirst'), 'error')
      return
    }
    const { label, ...biblePassage } = candidatePassage
    addItemMutation.mutate(
      { scheduleId: selectedScheduleId, input: { biblePassage } },
      {
        onSuccess: () =>
          showToast(t('panel.verseAdded', { reference: label }), 'success'),
        onError: () => showToast(t('messages.error'), 'error'),
      },
    )
  }, [selectedScheduleId, candidatePassage, addItemMutation, showToast, t])

  const {
    ref: songDropRef,
    isOver: isSongOver,
    justLanded: songJustLanded,
  } = useSongDropZone(acceptsSongDrop ? addSongToSelected : undefined)

  const handleDeleteSchedule = useCallback(() => {
    if (!selectedScheduleId) return
    deleteScheduleMutation.mutate(selectedScheduleId, {
      onSuccess: () => {
        setPendingDelete(false)
        // Fall back to whatever program is left; the effect above re-picks one.
        setSelectedScheduleId(null)
        showToast(t('messages.deleted'), 'success')
      },
      onError: () => showToast(t('messages.error'), 'error'),
    })
  }, [selectedScheduleId, deleteScheduleMutation, showToast, t])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !selectedScheduleId) return

      // Dragging happens inside whatever the operator is looking at, so the
      // move is computed on the visible rows. With no search on, displayItems
      // is the whole program and this is the plain case.
      const oldIndex = displayItems.findIndex((item) => item.id === active.id)
      const newIndex = displayItems.findIndex((item) => item.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reorderedVisible = arrayMove(displayItems, oldIndex, newIndex)
      const visibleIds = new Set(displayItems.map((item) => item.id))

      // The reordered rows are poured back into the slots those same rows
      // already occupied, so rows a search is hiding keep their exact place in
      // the program instead of drifting to the end.
      let cursor = 0
      const nextOrder = orderedItems.map((item) =>
        visibleIds.has(item.id) ? (reorderedVisible[cursor++] ?? item) : item,
      )

      setLocalOrder(nextOrder)

      // The endpoint rewrites sort_order from the index of every id it is
      // given, so it gets the program's full running order.
      reorderItemsMutation.mutate({
        scheduleId: selectedScheduleId,
        input: { itemIds: nextOrder.map((item) => item.id) },
      })
    },
    [displayItems, orderedItems, selectedScheduleId, reorderItemsMutation],
  )

  const isLoading =
    schedulesLoading || (!!selectedScheduleId && scheduleLoading)

  /** One compact program row, by kind. Clicking it puts the item on screen. */
  const renderItem = useCallback(
    (item: ScheduleItem, sortable: boolean) => {
      const isLive = liveItemId === item.id
      const rowRef = isLive ? liveRowRef : undefined

      if (item.itemType === 'bible_passage') {
        return (
          <ScheduleVerseRow
            key={item.id}
            item={item}
            isActive={
              !!activeReference &&
              item.biblePassageReference?.startsWith(activeReference) === true
            }
            isLive={isLive}
            isSortable={sortable}
            rowRef={rowRef}
            onPresent={() => presentItem(item)}
            onEdit={
              canEditProgram
                ? () => editorsRef.current?.editItem(item)
                : undefined
            }
            onSelect={() => onSelectPassage?.(item)}
            onRemove={() => handleRemove(item.id)}
            onToggleSung={() => handleToggleSung(item.id, item.isSung)}
          />
        )
      }

      if (item.itemType === 'song') {
        return (
          <ScheduleSongRow
            key={item.id}
            item={item}
            isActive={activeSongId === item.songId}
            isLive={isLive}
            isSortable={sortable}
            rowRef={rowRef}
            onPresent={() => presentItem(item)}
            onEdit={
              canEditProgram
                ? () => editorsRef.current?.editItem(item)
                : undefined
            }
            onSelect={() => item.songId && onSelectSong?.(item.songId)}
            onRemove={() => handleRemove(item.id)}
            onToggleSung={() => handleToggleSung(item.id, item.isSung)}
          />
        )
      }

      return (
        <ScheduleSlideRow
          key={item.id}
          item={item}
          isLive={isLive}
          isSortable={sortable}
          rowRef={rowRef}
          onPresent={() => presentItem(item)}
          onToggleSung={() => handleToggleSung(item.id, item.isSung)}
          onEdit={
            canEditProgram
              ? () => editorsRef.current?.editItem(item)
              : undefined
          }
          onRemove={canEditProgram ? () => handleRemove(item.id) : undefined}
        />
      )
    },
    [
      activeReference,
      activeSongId,
      handleRemove,
      handleToggleSung,
      canEditProgram,
      liveItemId,
      onSelectPassage,
      onSelectSong,
      presentItem,
    ],
  )

  return (
    <div
      ref={songDropRef}
      className={`bg-white dark:bg-gray-800 rounded-lg border flex flex-col overflow-hidden h-full transition-colors ${
        isSongOver
          ? 'border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/40'
          : 'border-gray-200 dark:border-gray-700'
      } ${songJustLanded ? 'song-drop-land' : ''}`}
      data-testid="schedule-songs-panel"
    >
      {/* Header — same shape as Marcaje/Versiuni so the column reads as one
          stack of accordion sections. */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? t('panel.expand') : t('panel.collapse')}
              className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 transition-transform hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>
          ) : null}
          <CalendarDays className="w-4 h-4 text-orange-500 dark:text-orange-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {t('panel.title')}
          </span>
          {orderedItems.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({isSearching ? `${displayItems.length}/` : ''}
              {orderedItems.length})
            </span>
          )}
        </div>
        {(selectedScheduleId || onAddAllBookmarks) && (
          <div className="flex items-center gap-1">
            {selectedScheduleId && canEditProgram ? (
              <ScheduleItemEditors
                ref={editorsRef}
                scheduleId={selectedScheduleId}
                onChanged={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['schedule', selectedScheduleId],
                  })
                }
                compactTrigger
              />
            ) : null}
            {/* Search lives behind this magnifier: the panel is narrow, and the
                running order is what the operator came here to read. */}
            {selectedScheduleId && (
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen((open) => {
                    if (open) setSearchQuery('')
                    return !open
                  })
                }}
                aria-expanded={isSearchOpen}
                aria-label={
                  isSearchOpen ? t('panel.closeSearch') : t('panel.openSearch')
                }
                title={
                  isSearchOpen ? t('panel.closeSearch') : t('panel.openSearch')
                }
                data-testid="schedule-search-toggle"
                className={`p-1.5 rounded-md transition-colors ${
                  isSearchOpen
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Making a program out of the marked songs is the one action here
                that does not need a program selected — the modal creates one
                on the spot — so it stays up before the first program exists,
                which is exactly when the operator needs it. */}
            {onAddAllBookmarks && (
              <button
                type="button"
                onClick={onAddAllBookmarks}
                data-testid="schedule-add-all-bookmarks"
                title={t('panel.addAllBookmarks')}
                className="p-1.5 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {selectedScheduleId && onOpenSchedule && (
              <button
                type="button"
                onClick={() => onOpenSchedule(selectedScheduleId)}
                className="p-1.5 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 transition-colors"
                title={t('panel.openSchedule')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            {selectedScheduleId && (
              <button
                type="button"
                onClick={() => setPendingDelete(true)}
                data-testid="schedule-delete"
                title={t('panel.deleteSchedule')}
                className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {isCollapsed ? null : (
        <>
          {/* Program picker — searchable, because a church accumulates a lot
              of past programs. */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <Combobox
              options={scheduleOptions}
              value={selectedScheduleId}
              onChange={(value) =>
                setSelectedScheduleId(
                  typeof value === 'number' ? value : Number(value) || null,
                )
              }
              placeholder={t('panel.selectSchedule')}
              allowClear={false}
              className="w-full"
            />
          </div>

          {isSearchOpen && (
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setSearchQuery('')
                      setIsSearchOpen(false)
                    }
                  }}
                  placeholder={t('panel.searchPlaceholder')}
                  data-testid="schedule-search-input"
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
                {searchQuery && (
                  <ClearSearchButton
                    inputRef={searchInputRef}
                    onClear={() => setSearchQuery('')}
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  />
                )}
              </div>
            </div>
          )}

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto scrollbar-thin min-h-0"
          >
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                ...
              </div>
            ) : schedules.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('panel.noSchedules')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {t('panel.noSchedulesDescription')}
                </p>
              </div>
            ) : displayItems.length === 0 ? (
              isSearching ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('panel.noResults')}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('panel.emptySchedule')}
                  </p>
                </div>
              )
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="p-2 flex flex-col gap-1.5">
                    {displayItems.map((item) => renderItem(item, !isSearching))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}

      {/* Deleting a program takes every song, passage and slide in it with
          it, so the confirmation names the program and says so plainly. */}
      <ConfirmModal
        isOpen={pendingDelete}
        title={t('panel.deleteScheduleTitle')}
        message={t('panel.deleteScheduleMessage', {
          title: schedule?.title ?? '',
          count: schedule?.itemCount ?? 0,
        })}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('modal.cancel')}
        variant="danger"
        onConfirm={handleDeleteSchedule}
        onCancel={() => setPendingDelete(false)}
      />
    </div>
  )
}
