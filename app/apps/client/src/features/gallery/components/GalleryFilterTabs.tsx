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
      className="flex w-full rounded-lg bg-gray-100 p-1 sm:inline-flex sm:w-auto dark:bg-gray-800"
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
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              isActive
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {t(filter.labelKey)}
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${
                isActive
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {counts[filter.value]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
