import { Play, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BackgroundMediaThumbnail } from '~/features/background-media/components/BackgroundMediaThumbnail'
import type { BackgroundMedia } from '~/features/background-media/service/types'
import { GalleryKindBadge } from './GalleryKindBadge'
import { GalleryMediaMeta } from './GalleryMediaMeta'

interface GalleryItemCardProps {
  media: BackgroundMedia
  /** Shown only when there is something to delete with (displays.edit) */
  onDelete?: () => void
  onPreview: () => void
}

/** One uploaded file: its thumbnail opens the preview, trash deletes it. */
export function GalleryItemCard({
  media,
  onDelete,
  onPreview,
}: GalleryItemCardProps) {
  const { t } = useTranslation('gallery')

  return (
    <div
      data-testid="gallery-item"
      data-media-id={media.id}
      data-kind={media.kind}
      className="overflow-hidden rounded-xl border border-line bg-panel"
    >
      <div className="relative aspect-video bg-black">
        <button
          type="button"
          onClick={onPreview}
          aria-label={t('item.preview')}
          title={t('item.preview')}
          className="absolute inset-0 h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        >
          <BackgroundMediaThumbnail media={media} />
          {media.kind === 'video' && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/60 p-2 text-white">
                <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              </span>
            </span>
          )}
        </button>
        <GalleryKindBadge
          kind={media.kind}
          className="pointer-events-none absolute top-1.5 left-1.5"
        />
        {onDelete && (
          <button
            type="button"
            data-testid="gallery-item-delete"
            onClick={onDelete}
            aria-label={t('item.delete')}
            title={t('item.delete')}
            className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
      <GalleryMediaMeta media={media} className="px-2.5 py-2 text-fg-hint" />
    </div>
  )
}
