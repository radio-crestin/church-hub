import { useTranslation } from 'react-i18next'

import type { SongSource } from '../providers'

interface SourcePickerProps {
  sources: SongSource[]
  selectedId: string
  onSelect: (sourceId: string) => void
}

/** A row of pills, one per song source; scrolls sideways on narrow screens. */
export function SourcePicker({
  sources,
  selectedId,
  onSelect,
}: SourcePickerProps) {
  const { t } = useTranslation('songDiscovery')

  return (
    <div
      role="tablist"
      aria-label={t('source.label')}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {sources.map((source) => {
        const selected = source.id === selectedId
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
          </button>
        )
      })}
    </div>
  )
}
