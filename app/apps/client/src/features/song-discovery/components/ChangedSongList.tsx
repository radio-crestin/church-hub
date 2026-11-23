import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChangedItem } from '../hooks/useChangedSelection'

interface ChangedSongListProps {
  items: ChangedItem[]
  /** Source names by id, shown under each song. */
  sourceNames: Map<string, string>
  openKey: string | null
  onOpen: (key: string) => void
  onSelect: (keys: string[], selected: boolean) => void
}

/**
 * The library songs a source changed, each picked to be updated with its
 * checkbox (all at first); a click on a song opens its old and new lyrics.
 */
export function ChangedSongList({
  items,
  sourceNames,
  openKey,
  onOpen,
  onSelect,
}: ChangedSongListProps) {
  const { t } = useTranslation('songDiscovery')
  const allRef = useRef<HTMLInputElement>(null)
  const selectedCount = items.filter((item) => item.selected).length
  const allSelected = selectedCount === items.length

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = selectedCount > 0 && !allSelected
    }
  }, [selectedCount, allSelected])

  return (
    <section
      data-testid="changed-songs"
      className="flex max-h-72 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <label className="flex cursor-pointer items-center gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-gray-800">
        <input
          ref={allRef}
          type="checkbox"
          aria-label={t('changed.selectAll')}
          checked={allSelected}
          onChange={() =>
            onSelect(
              items.map((item) => item.key),
              !allSelected,
            )
          }
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
        />
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
          {t('changed.title', { count: items.length })}
        </span>
      </label>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800 ${
              item.key === openKey
                ? 'bg-indigo-50 dark:bg-indigo-900/30'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <input
              type="checkbox"
              aria-label={t('changed.select', { title: item.library.title })}
              checked={item.selected}
              onChange={() => onSelect([item.key], !item.selected)}
              className="h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <button
              type="button"
              onClick={() => onOpen(item.key)}
              className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                  {item.library.title}
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {sourceNames.get(item.sourceId)}
                </span>
              </span>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                {t('changed.badge')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
