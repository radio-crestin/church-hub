import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { VerdictBadge } from './VerdictBadge'
import type { StagingItem } from '../types'

const ESTIMATED_ROW_HEIGHT = 56

interface SongChecklistProps {
  items: StagingItem[]
  /** Source names by id, shown under each song. */
  sourceNames: Map<string, string>
  openTempId: string | null
  onOpen: (tempId: string) => void
  onSelect: (tempIds: string[], selected: boolean) => void
}

/**
 * The songs the library lacks, each picked for import with its checkbox
 * (all picked at first); a click on a song opens it for review. Virtualized,
 * so thousands of songs never flood the page.
 */
export function SongChecklist({
  items,
  sourceNames,
  openTempId,
  onOpen,
  onSelect,
}: SongChecklistProps) {
  const { t } = useTranslation('songDiscovery')
  const scrollRef = useRef<HTMLDivElement>(null)
  const allRef = useRef<HTMLInputElement>(null)
  const selectedCount = items.filter((item) => item.selected).length
  const allSelected = items.length > 0 && selectedCount === items.length

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = selectedCount > 0 && !allSelected
    }
  }, [selectedCount, allSelected])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
  })

  return (
    <div className="flex min-h-[18rem] flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <label className="flex cursor-pointer items-center gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-gray-800">
        <input
          ref={allRef}
          type="checkbox"
          aria-label={t('songs.selectAll')}
          checked={allSelected}
          disabled={items.length === 0}
          onChange={() =>
            onSelect(
              items.map((item) => item.tempId),
              !allSelected,
            )
          }
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
        />
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
          {t('songs.title')}
        </span>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {t('songs.selected', {
            selected: selectedCount.toLocaleString(),
            total: items.length.toLocaleString(),
          })}
        </span>
      </label>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px` }}
          className="relative w-full"
        >
          {virtualizer.getVirtualItems().map((row) => {
            const item = items[row.index]
            const title = item.draft.title || t('untitled')
            return (
              <div
                key={item.tempId}
                data-index={row.index}
                ref={virtualizer.measureElement}
                className={`absolute top-0 left-0 flex w-full items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800 ${
                  item.tempId === openTempId
                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
                style={{ transform: `translateY(${row.start}px)` }}
              >
                <input
                  type="checkbox"
                  aria-label={t('actions.select', { title })}
                  checked={item.selected}
                  onChange={() => onSelect([item.tempId], !item.selected)}
                  className="h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <button
                  type="button"
                  onClick={() => onOpen(item.tempId)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                      {title}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {sourceNames.get(item.sourceId)}
                    </span>
                  </span>
                  <VerdictBadge verdict={item.verdict} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
