import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BackgroundMediaThumbnail } from './BackgroundMediaThumbnail'
import type { BackgroundMedia } from '../service'

interface BackgroundMediaTileProps {
  media: BackgroundMedia
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

/** One uploaded file in the picker grid: click to use it, trash to delete it. */
export function BackgroundMediaTile({
  media,
  isSelected,
  onSelect,
  onDelete,
}: BackgroundMediaTileProps) {
  const { t } = useTranslation('presentation')

  return (
    <div
      data-testid="background-media-item"
      data-media-id={media.id}
      data-selected={isSelected}
      className={`relative aspect-video overflow-hidden rounded-md bg-gray-900 ${
        isSelected
          ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
          : 'ring-1 ring-gray-200 hover:ring-gray-400 dark:ring-gray-700 dark:hover:ring-gray-500'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={t('screens.background.select')}
        title={t('screens.background.select')}
        className="absolute inset-0 h-full w-full"
      >
        <BackgroundMediaThumbnail media={media} />
      </button>
      <button
        type="button"
        data-testid="background-media-delete"
        onClick={onDelete}
        aria-label={t('screens.background.delete')}
        title={t('screens.background.delete')}
        className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white transition-colors hover:bg-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
