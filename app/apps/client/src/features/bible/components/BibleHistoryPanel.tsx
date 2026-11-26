import { ChevronDown, History, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import { normalizeForSearch } from '~/utils/normalizeForSearch'
import { saveTextFile } from '~/utils/saveTextFile'
import {
  BibleHistoryExportMenu,
  type BibleHistoryExportScope,
} from './BibleHistoryExportMenu'
import { BibleHistoryItem } from './BibleHistoryItem'
import { useBibleHistory, useClearHistory } from '../hooks'
import type { BibleHistoryItem as BibleHistoryItemType } from '../types'
import { formatHistoryAsSchedule } from '../utils/formatHistoryAsSchedule'
import { getLastSessionItems } from '../utils/getLastSessionItems'

const ITEMS_PER_PAGE = 20

interface BibleHistoryPanelProps {
  onSelectVerse: (item: BibleHistoryItemType) => void
  /**
   * Renders a chevron beside the title so the panel behaves like the song
   * page's Marcaje section: the body folds away while the header — and its
   * export/clear actions — stay reachable.
   */
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

interface GroupedHistory {
  date: string
  dateLabel: string
  items: BibleHistoryItemType[]
}

function formatDateLabel(date: Date, t: (key: string) => string): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (itemDate.getTime() === today.getTime()) {
    return t('history.today')
  }
  if (itemDate.getTime() === yesterday.getTime()) {
    return t('history.yesterday')
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function groupHistoryByDay(
  items: BibleHistoryItemType[],
  t: (key: string) => string,
): GroupedHistory[] {
  const groups = new Map<string, BibleHistoryItemType[]>()

  // Sort by newest first
  const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt)

  for (const item of sortedItems) {
    const date = new Date(item.createdAt)
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(item)
  }

  return Array.from(groups.entries()).map(([dateKey, groupItems]) => ({
    date: dateKey,
    dateLabel: formatDateLabel(new Date(groupItems[0].createdAt), t),
    items: groupItems,
  }))
}

export function BibleHistoryPanel({
  onSelectVerse,
  isCollapsed = false,
  onToggleCollapse,
}: BibleHistoryPanelProps) {
  const { t } = useTranslation('bible')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const previousItemCountRef = useRef(0)

  const { data: historyItems = [], isLoading } = useBibleHistory()
  const clearHistoryMutation = useClearHistory()
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter items by search query. Folded on both sides so "psalmi" finds
  // "Psalmi" and "cantare" finds "cântare".
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return historyItems
    const q = normalizeForSearch(searchQuery)
    return historyItems.filter(
      (item) =>
        normalizeForSearch(item.reference).includes(q) ||
        normalizeForSearch(item.text).includes(q),
    )
  }, [historyItems, searchQuery])

  // Group and sort items (newest first)
  const groupedHistory = useMemo(
    () => groupHistoryByDay(filteredItems, t),
    [filteredItems, t],
  )

  // Get visible items based on infinite scroll
  const visibleGroupedHistory = useMemo(() => {
    const result: GroupedHistory[] = []
    let count = 0

    for (const group of groupedHistory) {
      if (count >= visibleCount) break

      const remainingSlots = visibleCount - count
      if (group.items.length <= remainingSlots) {
        result.push(group)
        count += group.items.length
      } else {
        result.push({
          ...group,
          items: group.items.slice(0, remainingSlots),
        })
        count += remainingSlots
      }
    }

    return result
  }, [groupedHistory, visibleCount])

  const totalItems = filteredItems.length
  const hasMore = visibleCount < totalItems

  // Scroll to top when new item is added
  useEffect(() => {
    if (historyItems.length > previousItemCountRef.current) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    previousItemCountRef.current = historyItems.length
  }, [historyItems.length])

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const loadMoreElement = loadMoreRef.current
    if (!loadMoreElement || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, totalItems))
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(loadMoreElement)
    return () => observer.disconnect()
  }, [hasMore, totalItems])

  // Reset visible count when history or search changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [filteredItems.length])

  const handleClear = useCallback(() => {
    clearHistoryMutation.mutate()
  }, [clearHistoryMutation])

  // The most recent sitting, used both for the menu's counter and its export.
  const sessionItems = useMemo(
    () => getLastSessionItems(historyItems),
    [historyItems],
  )

  const handleExport = useCallback(
    async (scope: BibleHistoryExportScope) => {
      const isSession = scope === 'session'
      const items = isSession ? sessionItems : historyItems
      if (items.length === 0) return

      const content = formatHistoryAsSchedule(items, {
        title: isSession
          ? t('history.exportTitleSession')
          : t('history.exportTitle'),
        help: t('history.exportHelp'),
      })
      const day = new Date().toISOString().split('T')[0]
      const defaultFilename = isSession
        ? `bible-history-session-${day}.schedule.txt`
        : `bible-history-${day}.schedule.txt`

      await saveTextFile({
        content,
        defaultFilename,
        filterName: 'Schedule Text',
      })
    },
    [historyItems, sessionItems, t],
  )

  return (
    <div className="bg-panel rounded-xl border border-line flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-line flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={
                isCollapsed ? t('history.expand') : t('history.collapse')
              }
              data-testid="bible-history-collapse"
              className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-hint transition-transform hover:bg-hover"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                strokeWidth={1.75}
              />
            </button>
          ) : null}
          <History className="w-4 h-4 text-fg-label" strokeWidth={1.5} />
          <span className="text-[13px] font-medium text-fg">
            {t('history.title')}
          </span>
          {historyItems.length > 0 && (
            <span className="text-xs text-fg-hint tabular-nums">
              ({searchQuery ? `${filteredItems.length}/` : ''}
              {historyItems.length})
            </span>
          )}
        </div>
        {historyItems.length > 0 && (
          <div className="flex items-center gap-0.5">
            <BibleHistoryExportMenu
              sessionCount={sessionItems.length}
              totalCount={historyItems.length}
              onExport={handleExport}
            />
            <button
              type="button"
              onClick={handleClear}
              disabled={clearHistoryMutation.isPending}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              title={t('history.clear')}
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {isCollapsed ? null : (
        <>
          {/* Search */}
          {historyItems.length > 3 && (
            <div className="px-3 py-1.5 border-b border-line flex-shrink-0">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-hint"
                  strokeWidth={1.75}
                />
                <input
                  ref={searchInputRef}
                  data-slide-navigation=""
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('history.searchPlaceholder')}
                  className="w-full h-8 pl-8 pr-7 text-[13px] bg-field rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                />
                {searchQuery && (
                  <ClearSearchButton
                    inputRef={searchInputRef}
                    onClear={() => setSearchQuery('')}
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-hint hover:text-fg-label"
                  />
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto scrollbar-thin min-h-0"
          >
            {isLoading ? (
              <div className="px-4 py-6 text-center text-[13px] text-fg-hint">
                ...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-fg-hint">
                {t('history.empty')}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-fg-hint">
                {t('history.noResults')}
              </div>
            ) : (
              <div className="p-1.5 flex flex-col gap-2">
                {visibleGroupedHistory.map((group) => (
                  <div key={group.date}>
                    {/* Date Header */}
                    <div className="sticky top-0 z-10 bg-panel px-2 py-1.5">
                      <span className="text-xs font-medium text-fg-hint">
                        {group.dateLabel}
                      </span>
                    </div>
                    {/* Items for this day */}
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => (
                        <BibleHistoryItem
                          key={item.id}
                          item={item}
                          onClick={() => onSelectVerse(item)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {/* Load more trigger */}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="py-2 text-center text-xs text-fg-hint"
                  >
                    ...
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
