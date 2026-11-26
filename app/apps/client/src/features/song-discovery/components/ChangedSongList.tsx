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
      className="flex max-h-72 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-panel"
    >
      <label className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5">
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
          className="h-4 w-4 rounded border-line text-primary focus:ring-focus bg-field"
        />
        <span className="flex-1 text-sm font-medium text-fg-body">
          {t('changed.title', { count: items.length })}
        </span>
      </label>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-3 border-b border-line px-4 ${
              item.key === openKey ? 'bg-selected' : 'hover:bg-hover'
            }`}
          >
            <input
              type="checkbox"
              aria-label={t('changed.select', { title: item.library.title })}
              checked={item.selected}
              onChange={() => onSelect([item.key], !item.selected)}
              className="h-4 w-4 shrink-0 rounded border-line text-primary focus:ring-focus bg-field"
            />
            <button
              type="button"
              onClick={() => onOpen(item.key)}
              className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">
                  {item.library.title}
                </span>
                <span className="block truncate text-xs text-fg-hint">
                  {sourceNames.get(item.sourceId)}
                </span>
              </span>
              <span
                className="inline-flex shrink-0 items-center text-xs font-medium text-fg-label"
                data-testid={item.edited ? 'changed-edited-badge' : undefined}
              >
                {item.edited ? t('changed.editedBadge') : t('changed.badge')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
