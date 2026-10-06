import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime } from '~/features/sync/utils/formatRelativeTime'
import { SourceStatus } from './SourceStatus'
import type { SourceUpdate } from '../hooks/useSongDiscoverySync'
import type { SongSource } from '../providers'

interface SourcePickerProps {
  sources: SongSource[]
  selectedId: string
  onSelect: (sourceId: string) => void
  /** What the last check of each source found, by source id. */
  updates: Map<string, SourceUpdate>
  isChecking: boolean
  onCheckAll: () => void
}

/** Names more than one source goes by, e.g. a link named like a built-in. */
function sharedNames(sources: SongSource[]): Set<string> {
  const seen = new Set<string>()
  const shared = new Set<string>()
  for (const { name } of sources) {
    const key = name.trim().toLowerCase()
    if (seen.has(key)) shared.add(key)
    seen.add(key)
  }
  return shared
}

/**
 * One tab per song source with its count of new songs (or a check mark when
 * the library has them all), and a button that checks every source again.
 * The tabs scroll sideways on narrow screens.
 */
export function SourcePicker({
  sources,
  selectedId,
  onSelect,
  updates,
  isChecking,
  onCheckAll,
}: SourcePickerProps) {
  const { t, i18n } = useTranslation('songDiscovery')
  const shared = sharedNames(sources)
  const lastCheckedAt = Math.max(
    0,
    ...[...updates.values()].map((u) => u.checkedAt),
  )

  /** Where a source comes from, shown only when its name is not enough. */
  const origin = (source: SongSource): string | null => {
    if (!shared.has(source.name.trim().toLowerCase())) return null
    if (source.origin === 'link') return new URL(source.url).host
    if (source.origin === 'file') return t('source.openedFile')
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label={t('source.label')}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {sources.map((source) => {
          const selected = source.id === selectedId
          const from = origin(source)
          const update = updates.get(source.id)
          const label = from ? `${source.name} ${from}` : source.name
          return (
            <button
              key={source.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={label}
              onClick={() => onSelect(source.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-2 pl-4 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>
                {source.name}
                {from && (
                  <span className="ml-1 text-xs font-normal opacity-75">
                    {from}
                  </span>
                )}
              </span>
              <SourceStatus update={update} selected={selected} />
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {lastCheckedAt > 0 && (
          <span>
            {t('source.lastChecked', {
              when: formatRelativeTime(lastCheckedAt, i18n.language),
            })}
          </span>
        )}
        <button
          type="button"
          onClick={onCheckAll}
          disabled={isChecking}
          className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`}
          />
          {isChecking ? t('source.checkingAll') : t('source.checkAll')}
        </button>
      </div>
    </div>
  )
}
