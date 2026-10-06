import { useTranslation } from 'react-i18next'

import type { SongSource } from '../providers'

interface SourcePickerProps {
  sources: SongSource[]
  selectedId: string
  onSelect: (sourceId: string) => void
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

/** A row of pills, one per song source; scrolls sideways on narrow screens. */
export function SourcePicker({
  sources,
  selectedId,
  onSelect,
}: SourcePickerProps) {
  const { t } = useTranslation('songDiscovery')
  const shared = sharedNames(sources)

  /** Where a source comes from, shown only when its name is not enough. */
  const origin = (source: SongSource): string | null => {
    if (!shared.has(source.name.trim().toLowerCase())) return null
    if (source.origin === 'link') return new URL(source.url).host
    if (source.origin === 'file') return t('source.openedFile')
    return null
  }

  return (
    <div
      role="tablist"
      aria-label={t('source.label')}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {sources.map((source) => {
        const selected = source.id === selectedId
        const from = origin(source)
        return (
          <button
            key={source.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(source.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {source.name}
            {from && (
              <>
                {' '}
                <span className="text-xs font-normal opacity-75">{from}</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
