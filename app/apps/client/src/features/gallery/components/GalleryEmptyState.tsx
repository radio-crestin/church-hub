import { Images } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { GalleryFilter } from '../types'

interface GalleryEmptyStateProps {
  filter: GalleryFilter
}

/** Nothing uploaded yet (or nothing of the filtered kind), and what fits. */
export function GalleryEmptyState({ filter }: GalleryEmptyStateProps) {
  const { t } = useTranslation('gallery')

  return (
    <div
      data-testid="gallery-empty"
      className="flex flex-col items-center justify-center px-4 py-16 text-center text-gray-500 dark:text-gray-400"
    >
      <Images size={48} className="mb-4 opacity-50" aria-hidden="true" />
      <p className="text-lg font-medium">{t(`empty.${filter}`)}</p>
      <p className="mt-1 max-w-md text-sm">{t('empty.hint')}</p>
    </div>
  )
}
