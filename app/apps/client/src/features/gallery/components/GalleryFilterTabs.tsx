import { useTranslation } from 'react-i18next'

import { GALLERY_FILTERS } from '../constants'
import type { GalleryFilter } from '../types'

interface GalleryFilterTabsProps {
  value: GalleryFilter
  counts: Record<GalleryFilter, number>
  onChange: (filter: GalleryFilter) => void
}

/** Segmented control: all files, images only or videos only, with counts. */
export function GalleryFilterTabs({
  value,
  counts,
  onChange,
}: GalleryFilterTabsProps) {
  const { t } = useTranslation('gallery')

  return (
    <div
      role="group"
      aria-label={t('filters.label')}
      className="flex w-full rounded-lg bg-field p-0.5 sm:inline-flex sm:w-auto"
    >
      {GALLERY_FILTERS.map((filter) => {
        const isActive = filter.value === value
        return (
          <button
            key={filter.value}
            type="button"
            data-testid={filter.testId}
            aria-pressed={isActive}
            onClick={() => onChange(filter.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors sm:flex-none ${
              isActive ? 'bg-selected text-fg' : 'text-fg-label hover:text-fg'
            }`}
          >
            {t(filter.labelKey)}
            <span className="text-xs tabular-nums text-fg-hint">
              {counts[filter.value]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
