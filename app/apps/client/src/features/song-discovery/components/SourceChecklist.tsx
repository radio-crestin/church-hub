import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ManagedSourceNote } from './ManagedSourceNote'
import type { SongSource } from '../providers'

interface SourceChecklistProps {
  sources: SongSource[]
  isChecked: (sourceId: string) => boolean
  onToggle: (sourceId: string) => void
  /** Songs each source has that the library lacks. */
  counts: Map<string, number>
  isLoading: boolean
  failed: SongSource[]
  /** Why the server's last check of a source failed, by source id. */
  errors: Map<string, string>
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
  errors,
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
    if (errors.has(source.id)) {
      return (
        <AlertTriangle
          aria-hidden
          className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400"
        />
      )
    }
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
        <Loader2 className="h-4 w-4 animate-spin text-fg-hint" />
      ) : null
    }
    if (count === 0) {
      return (
        <CheckCircle2
          aria-label={t('source.upToDate')}
          className="h-4 w-4 text-ok"
        />
      )
    }
    return (
      <span className="text-xs tabular-nums text-fg-hint">
        {count.toLocaleString()}
      </span>
    )
  }

  return (
    <fieldset className="rounded-xl border border-line bg-panel p-2">
      <legend className="px-2 text-xs font-medium text-fg-hint">
        {t('source.label')}
      </legend>
      {sources.map((source) => {
        const from = origin(source)
        const label = from ? `${source.name} ${from}` : source.name
        const error = errors.get(source.id)
        return (
          <label
            key={source.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-hover"
          >
            <input
              type="checkbox"
              aria-label={label}
              checked={isChecked(source.id)}
              onChange={() => onToggle(source.id)}
              className="h-4 w-4 rounded border-line text-primary focus:ring-focus bg-field"
            />
            <span className="min-w-0 flex-1 text-sm text-fg-body">
              <span className="block truncate">
                {source.name}
                {from && (
                  <span className="ml-1 text-xs text-fg-hint">{from}</span>
                )}
              </span>
              {source.managed && <ManagedSourceNote source={source} />}
              {error && (
                <span
                  data-testid={`source-error-${source.id}`}
                  className="block break-words text-xs text-red-600 dark:text-red-400"
                >
                  {error}
                </span>
              )}
            </span>
            {status(source)}
          </label>
        )
      })}
    </fieldset>
  )
}
