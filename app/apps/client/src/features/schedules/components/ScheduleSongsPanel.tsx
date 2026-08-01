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
import { CalendarDays, ChevronDown, ExternalLink, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { ClearSearchButton } from '~/ui/search'
import { ScheduleSongRow } from './ScheduleSongRow'
import {
  useMarkScheduleItemSung,
  useRemoveItemFromSchedule,
  useReorderScheduleItems,
  useSchedule,
  useSchedules,
} from '../hooks'
import type { ScheduleItem } from '../types'

/** Remembers the operator's last picked program across song navigations. */
const SELECTED_SCHEDULE_STORAGE_KEY = 'songPage.selectedScheduleId'

type SungFilter = 'all' | 'pending' | 'sung'

function readStoredScheduleId(): number | null {
  try {
    const stored = localStorage.getItem(SELECTED_SCHEDULE_STORAGE_KEY)
    if (!stored) return null
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

interface ScheduleSongsPanelProps {
  /** Highlights the song currently open on the song page. */
  activeSongId?: number
  onSelectSong: (songId: number) => void
  /** Opens the full program page. */
  onOpenSchedule?: (scheduleId: number) => void
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
export function ScheduleSongsPanel({
  activeSongId,
  onSelectSong,
  onOpenSchedule,
  isCollapsed = false,
  onToggleCollapse,
}: ScheduleSongsPanelProps) {
  const { t } = useTranslation('schedules')
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedules()
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    readStoredScheduleId,
  )
  const [sungFilter, setSungFilter] = useState<SungFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const removeItemMutation = useRemoveItemFromSchedule()
  const markSungMutation = useMarkScheduleItemSung()
  const reorderItemsMutation = useReorderScheduleItems()
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

  // Only songs — a program's bible passages, announcements and scenes are not
  // what this panel is for.
  const serverSongItems = useMemo(
    () => (schedule?.items ?? []).filter((item) => item.itemType === 'song'),
    [schedule],
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
      // songs shown here. Songs are poured back into the slots songs already
      // occupied, which leaves bible passages, announcements and scenes exactly
      // where the operator put them in the program editor.
      const fullOrder = schedule?.items ?? []
      let cursor = 0
      const itemIds = fullOrder.map((item) =>
        item.itemType === 'song'
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

  const isSearching = searchQuery.trim().length > 0
  // Dragging only makes sense on the full list — a filtered view has no
  // meaningful "drop between these two" position. Same rule as Marcaje.
  const isFiltering = isSearching || sungFilter !== 'all'
  const isLoading =
    schedulesLoading || (!!selectedScheduleId && scheduleLoading)

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full"
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
                {filteredItems.map((item) => (
                  <ScheduleSongRow
                    key={item.id}
                    item={item}
                    isActive={activeSongId === item.songId}
                    isSortable={false}
                    onSelect={() => item.songId && onSelectSong(item.songId)}
                    onRemove={() => handleRemove(item.id)}
                    onToggleSung={() => handleToggleSung(item.id, item.isSung)}
                  />
                ))}
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
                    {songItems.map((item) => (
                      <ScheduleSongRow
                        key={item.id}
                        item={item}
                        isActive={activeSongId === item.songId}
                        isSortable
                        onSelect={() =>
                          item.songId && onSelectSong(item.songId)
                        }
                        onRemove={() => handleRemove(item.id)}
                        onToggleSung={() =>
                          handleToggleSung(item.id, item.isSung)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}
    </div>
  )
}
