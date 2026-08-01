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
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ExternalLink,
  Loader2,
  Music,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSongDropZone } from '~/features/songs/hooks/useSongDropZone'
import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { ConfirmModal } from '~/ui/modal'
import { ClearSearchButton } from '~/ui/search'
import { useToast } from '~/ui/toast'
import { ScheduleSongRow } from './ScheduleSongRow'
import { ScheduleVerseRow } from './ScheduleVerseRow'
import {
  useAddItemToSchedule,
  useDeleteSchedule,
  useMarkScheduleItemSung,
  useRemoveItemFromSchedule,
  useReorderScheduleItems,
  useSchedule,
  useSchedules,
} from '../hooks'
import type { AddToScheduleInput, ScheduleItem } from '../types'

/**
 * Remembers the operator's last picked program. Deliberately one key for every
 * page: picking a program on the song page and walking into the Bible page
 * should land on the same program.
 */
const SELECTED_SCHEDULE_STORAGE_KEY = 'songPage.selectedScheduleId'

/** Per-variant key for the "also show the other kind" switch. */
const SHOW_OTHER_STORAGE_KEY = {
  songs: 'programPanel.showVerses',
  verses: 'programPanel.showSongs',
} as const

type SungFilter = 'all' | 'pending' | 'sung'

/**
 * The program the Programe panel currently has selected. Exported so a page
 * toolbar can act on the same selection without mirroring it into its own
 * state — the panel is the single owner and persists it.
 */
export function readSelectedScheduleId(): number | null {
  try {
    const stored = localStorage.getItem(SELECTED_SCHEDULE_STORAGE_KEY)
    if (!stored) return null
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

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
 * The song page's "Programe" section: pick one of the operator's programs from
 * a searchable dropdown and work through its songs without leaving the song.
 *
 * Deliberately mirrors the Marcaje panel — same row design, same
 * all/pending/sung segmented filter, same click-to-open and X-to-remove — so
 * the two lists in this column read as one system. Non-song items (bible
 * passages, announcements, scenes) are filtered out; this panel is about
 * singing through a program.
 */
export function SchedulePanel({
  variant = 'songs',
  activeSongId,
  activeReference = null,
  onSelectSong,
  onSelectPassage,
  onOpenSchedule,
  candidateSong = null,
  candidatePassage = null,
  acceptsSongDrop = false,
  onAddAllBookmarks,
  isCollapsed = false,
  onToggleCollapse,
}: SchedulePanelProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedules()
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    readSelectedScheduleId,
  )
  const [sungFilter, setSungFilter] = useState<SungFilter>('all')
  // "Vezi versete" on the song page / "Vezi cantari" on the Bible page: when
  // on, the other kind is listed too and clicking it jumps to that module.
  const [showOther, setShowOther] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SHOW_OTHER_STORAGE_KEY[variant]) === 'true'
    } catch {
      return false
    }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

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
    if (schedules.length === 0) return
    const stillExists = schedules.some((s) => s.id === selectedScheduleId)
    if (!stillExists) {
      setSelectedScheduleId(schedules[0]?.id ?? null)
    }
  }, [schedules, selectedScheduleId])

  useEffect(() => {
    try {
      if (selectedScheduleId) {
        localStorage.setItem(
          SELECTED_SCHEDULE_STORAGE_KEY,
          String(selectedScheduleId),
        )
      } else {
        localStorage.removeItem(SELECTED_SCHEDULE_STORAGE_KEY)
      }
    } catch {
      // localStorage unavailable (private mode) — selection just won't persist.
    }
  }, [selectedScheduleId])

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_OTHER_STORAGE_KEY[variant], String(showOther))
    } catch {
      // localStorage unavailable — the switch just won't persist.
    }
  }, [variant, showOther])

  const { data: schedule, isLoading: scheduleLoading } = useSchedule(
    selectedScheduleId ?? undefined,
  )

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

  const primaryType = variant === 'songs' ? 'song' : 'bible_passage'
  const otherType = variant === 'songs' ? 'bible_passage' : 'song'

  // Announcements, Versete Tineri and OBS scenes never appear here — this
  // panel is about working through a program's songs and readings.
  const serverSongItems = useMemo(
    () =>
      (schedule?.items ?? []).filter(
        (item) =>
          item.itemType === primaryType ||
          (showOther && item.itemType === otherType),
      ),
    [schedule, primaryType, otherType, showOther],
  )
  const songItems = localOrder ?? serverSongItems

  useEffect(() => {
    setLocalOrder(null)
  }, [serverSongItems])

  const sungCount = useMemo(
    () => songItems.filter((item) => item.isSung).length,
    [songItems],
  )
  const pendingCount = songItems.length - sungCount

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return songItems.filter((item) => {
      if (sungFilter === 'sung' && !item.isSung) return false
      if (sungFilter === 'pending' && item.isSung) return false
      if (!q) return true
      if (item.itemType === 'bible_passage') {
        return (
          item.biblePassageReference?.toLowerCase().includes(q) ||
          item.biblePassageVerses.some((verse) =>
            verse.text.toLowerCase().includes(q),
          )
        )
      }
      return (
        item.song?.title.toLowerCase().includes(q) ||
        item.song?.categoryName?.toLowerCase().includes(q) ||
        item.keyLine?.toLowerCase().includes(q) ||
        item.song?.tagNames?.some((name) => name.toLowerCase().includes(q))
      )
    })
  }, [songItems, searchQuery, sungFilter])

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

  /** Appends a song to the selected program, skipping duplicates. */
  const addSongToSelected = useCallback(
    (song: { id: number; title: string }) => {
      if (!selectedScheduleId) {
        showToast(t('panel.selectScheduleFirst'), 'error')
        return
      }
      if (songItems.some((item) => item.songId === song.id)) {
        showToast(t('panel.alreadyInSchedule', { title: song.title }), 'info')
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
    [selectedScheduleId, songItems, addItemMutation, showToast, t],
  )

  /** Appends the Bible page's current passage to the selected program. */
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

      const oldIndex = songItems.findIndex((item) => item.id === active.id)
      const newIndex = songItems.findIndex((item) => item.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const newSongOrder = arrayMove(songItems, oldIndex, newIndex)
      setLocalOrder(newSongOrder)

      // The endpoint rewrites sort_order from the index of every id it is
      // given, so it needs the program's FULL running order — not just the
      // rows shown here. The reordered rows are poured back into the slots
      // those same rows already occupied, so whatever this panel does not list
      // (announcements, Versete Tineri, OBS scenes — and songs or passages when
      // the cross-module switch is off) keeps the exact position the operator
      // gave it in the program editor.
      //
      // Keying on the visible ids rather than on item kind is what lets this
      // work unchanged for a mixed list: with the switch on, songs and passages
      // share one slot set and reorder freely against each other.
      const visibleIds = new Set(songItems.map((item) => item.id))
      const fullOrder = schedule?.items ?? []
      let cursor = 0
      const itemIds = fullOrder.map((item) =>
        visibleIds.has(item.id)
          ? (newSongOrder[cursor++]?.id ?? item.id)
          : item.id,
      )

      reorderItemsMutation.mutate({
        scheduleId: selectedScheduleId,
        input: { itemIds },
      })
    },
    [songItems, schedule, selectedScheduleId, reorderItemsMutation],
  )

  const renderRow = useCallback(
    (item: ScheduleItem, sortable: boolean) => {
      if (item.itemType === 'bible_passage') {
        return (
          <ScheduleVerseRow
            key={item.id}
            item={item}
            isActive={
              !!activeReference &&
              item.biblePassageReference?.startsWith(activeReference) === true
            }
            isSortable={sortable}
            onSelect={() => onSelectPassage?.(item)}
            onRemove={() => handleRemove(item.id)}
            onToggleSung={() => handleToggleSung(item.id, item.isSung)}
          />
        )
      }
      return (
        <ScheduleSongRow
          key={item.id}
          item={item}
          isActive={activeSongId === item.songId}
          isSortable={sortable}
          onSelect={() => item.songId && onSelectSong?.(item.songId)}
          onRemove={() => handleRemove(item.id)}
          onToggleSung={() => handleToggleSung(item.id, item.isSung)}
        />
      )
    },
    [
      activeReference,
      activeSongId,
      onSelectPassage,
      onSelectSong,
      handleRemove,
      handleToggleSung,
    ],
  )

  const isSearching = searchQuery.trim().length > 0
  // Dragging only makes sense on an unfiltered list: a filtered view has no
  // meaningful "drop between these two" position, since the rows in between
  // are hidden. A *mixed* list is fine — see handleDragEnd.
  const isFiltering = isSearching || sungFilter !== 'all'
  const isLoading =
    schedulesLoading || (!!selectedScheduleId && scheduleLoading)

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
          {songItems.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({isSearching ? `${filteredItems.length}/` : ''}
              {songItems.length})
            </span>
          )}
        </div>
        {selectedScheduleId && (
          <div className="flex items-center gap-1">
            {/* Adds the song the page has in focus — the open song, or the
                highlighted row in the search list. */}
            <button
              type="button"
              onClick={() => {
                if (variant === 'verses') {
                  addPassageToSelected()
                } else if (candidateSong) {
                  addSongToSelected(candidateSong)
                }
              }}
              disabled={
                (variant === 'verses' ? !candidatePassage : !candidateSong) ||
                addItemMutation.isPending
              }
              data-testid="schedule-add-candidate-song"
              title={
                variant === 'verses'
                  ? candidatePassage
                    ? t('panel.addVerse', { reference: candidatePassage.label })
                    : t('panel.addVerseDisabled')
                  : candidateSong
                    ? t('panel.addSong', { title: candidateSong.title })
                    : t('panel.addSongDisabled')
              }
              className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
            >
              {addItemMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
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
            {onOpenSchedule && (
              <button
                type="button"
                onClick={() => onOpenSchedule(selectedScheduleId)}
                className="p-1.5 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 transition-colors"
                title={t('panel.openSchedule')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setPendingDelete(true)}
              data-testid="schedule-delete"
              title={t('panel.deleteSchedule')}
              className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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

          {/* Cross-module switch: shows the program's other content kind and
              makes each row jump to the module that owns it. */}
          <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowOther((value) => !value)}
              aria-pressed={showOther}
              data-testid="schedule-show-other-toggle"
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                showOther
                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                  : 'bg-gray-50 text-gray-500 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <span
                className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
                  showOther ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                    showOther ? 'translate-x-3' : 'translate-x-0.5'
                  }`}
                />
              </span>
              {variant === 'songs' ? (
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Music className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">
                {variant === 'songs'
                  ? t('panel.showVerses')
                  : t('panel.showSongs')}
              </span>
            </button>
          </div>

          {songItems.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div
                className="flex items-center gap-1 rounded-md bg-gray-100 p-0.5 dark:bg-gray-900"
                data-testid="schedule-sung-filter"
              >
                {(
                  [
                    {
                      key: 'all',
                      label: t('panel.filterAll'),
                      n: songItems.length,
                    },
                    {
                      key: 'pending',
                      label: t('panel.filterPending'),
                      n: pendingCount,
                    },
                    { key: 'sung', label: t('panel.filterSung'), n: sungCount },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSungFilter(opt.key)}
                    aria-pressed={sungFilter === opt.key}
                    data-testid={`schedule-filter-${opt.key}`}
                    className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      sungFilter === opt.key
                        ? 'bg-white text-orange-700 shadow-sm dark:bg-gray-700 dark:text-orange-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                    <span className="ml-1 opacity-60">{opt.n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {songItems.length > 3 && (
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('panel.searchPlaceholder')}
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

          <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
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
            ) : songItems.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('panel.emptySchedule')}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('panel.noResults')}
              </div>
            ) : isFiltering ? (
              <div className="p-2 flex flex-col gap-1.5">
                {filteredItems.map((item) => renderRow(item, false))}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={songItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="p-2 flex flex-col gap-1.5">
                    {songItems.map((item) => renderRow(item, true))}
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
