import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SongSource } from '../providers'

interface SourceChecklistProps {
  sources: SongSource[]
  isChecked: (sourceId: string) => boolean
  onToggle: (sourceId: string) => void
  /** Songs each source has that the library lacks. */
  counts: Map<string, number>
  isLoading: boolean
  failed: SongSource[]
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

/** One row per song source: ticked to show its new songs, with their count. */
export function SourceChecklist({
  sources,
  isChecked,
  onToggle,
  counts,
  isLoading,
  failed,
}: SourceChecklistProps) {
  const { t } = useTranslation('songDiscovery')
  const shared = sharedNames(sources)

  /** Where a source comes from, shown only when its name is not enough. */
  const origin = (source: SongSource): string | null => {
    if (!shared.has(source.name.trim().toLowerCase())) return null
    if (source.origin === 'link') return new URL(source.url).host
    if (source.origin === 'file') return t('source.openedFile')
    return null
  }

  const status = (source: SongSource) => {
    if (failed.includes(source)) {
      return (
        <AlertTriangle
          aria-label={t('error.failed')}
          className="h-4 w-4 text-amber-500"
        />
      )
    }
    const count = counts.get(source.id)
    if (count === undefined) {
      return isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : null
    }
    if (count === 0) {
      return (
        <CheckCircle2
          aria-label={t('source.upToDate')}
          className="h-4 w-4 text-green-600 dark:text-green-400"
        />
      )
    }
    return (
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
        {count.toLocaleString()}
      </span>
    )
  }

  return (
    <fieldset className="rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('source.label')}
      </legend>
      {sources.map((source) => {
        const from = origin(source)
        const label = from ? `${source.name} ${from}` : source.name
        return (
          <label
            key={source.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          >
            <input
              type="checkbox"
              aria-label={label}
              checked={isChecked(source.id)}
              onChange={() => onToggle(source.id)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
              {source.name}
              {from && (
                <span className="ml-1 text-xs text-gray-500">{from}</span>
              )}
            </span>
            {status(source)}
          </label>
        )
      })}
    </fieldset>
  )
}
