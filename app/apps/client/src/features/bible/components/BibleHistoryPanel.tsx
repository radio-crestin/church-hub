import { Download, History, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BibleHistoryItem } from './BibleHistoryItem'
import { useBibleHistory, useClearHistory } from '../hooks'
import type { BibleHistoryItem as BibleHistoryItemType } from '../types'

const ITEMS_PER_PAGE = 20

interface BibleHistoryPanelProps {
  onSelectVerse: (item: BibleHistoryItemType) => void
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

function getTodayItems(items: BibleHistoryItemType[]): BibleHistoryItemType[] {
  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const todayEnd = todayStart + 24 * 60 * 60 * 1000

  return items.filter(
    (item) => item.createdAt >= todayStart && item.createdAt < todayEnd,
  )
}

function formatHistoryAsSchedule(
  items: BibleHistoryItemType[],
  t: (key: string) => string,
): string {
  const lines: string[] = []

  // Add format help comments
  lines.push(`# ${t('history.exportTitle')}`)
  lines.push(`# ${t('history.exportHelp')}`)
  lines.push('')

  // Sort by newest first and add each verse as a schedule item
  const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt)

  for (const item of sortedItems) {
    // Remove translation suffix from reference if present (e.g., "Ioan 3:16 - VDCC" -> "Ioan 3:16")
    const refWithoutTranslation = item.reference
      .replace(/\s*-\s*[A-Z]+$/, '')
      .trim()
    lines.push(`${refWithoutTranslation} [V]`)
    // Add verse content as comment (ignored by parser)
    lines.push(`# ${item.text}`)
    lines.push('')
  }

  return lines.join('\n')
}

export function BibleHistoryPanel({ onSelectVerse }: BibleHistoryPanelProps) {
  const { t } = useTranslation('bible')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const previousItemCountRef = useRef(0)

  const { data: historyItems = [], isLoading } = useBibleHistory()
  const clearHistoryMutation = useClearHistory()

  // Group and sort items (newest first)
  const groupedHistory = useMemo(
    () => groupHistoryByDay(historyItems, t),
    [historyItems, t],
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

  const totalItems = historyItems.length
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

  // Reset visible count when history changes significantly
  useEffect(() => {
    if (historyItems.length === 0) {
      setVisibleCount(ITEMS_PER_PAGE)
    }
  }, [historyItems.length])

  const handleClear = useCallback(() => {
    clearHistoryMutation.mutate()
  }, [clearHistoryMutation])

  const handleExport = useCallback(async () => {
    const todayItems = getTodayItems(historyItems)
    const content = formatHistoryAsSchedule(todayItems, t)
    const defaultFilename = `bible-history-${new Date().toISOString().split('T')[0]}.schedule.txt`

    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

    if (isTauri) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')

      const savePath = await save({
        defaultPath: defaultFilename,
        filters: [{ name: 'Schedule Text', extensions: ['txt'] }],
      })

      if (savePath) {
        await writeTextFile(savePath, content)
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = defaultFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }, [historyItems, t])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('history.title')}
          </span>
          {historyItems.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({historyItems.length})
            </span>
          )}
        </div>
        {historyItems.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExport}
              className="p-1.5 rounded-md bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50 transition-colors"
              title={t('history.export')}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={clearHistoryMutation.isPending}
              className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
              title={t('history.clear')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-thin min-h-0"
      >
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            ...
          </div>
        ) : historyItems.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('history.empty')}
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-3">
            {visibleGroupedHistory.map((group) => (
              <div key={group.date}>
                {/* Date Header */}
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-2 py-1.5 mb-1.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {group.dateLabel}
                  </span>
                </div>
                {/* Items for this day */}
                <div className="flex flex-col gap-1.5">
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
                className="py-2 text-center text-xs text-gray-400"
              >
                ...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
