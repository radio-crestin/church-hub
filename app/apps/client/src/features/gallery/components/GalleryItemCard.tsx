import { Play, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BackgroundMediaThumbnail } from '~/features/background-media/components/BackgroundMediaThumbnail'
import type { BackgroundMedia } from '~/features/background-media/service/types'
import { GalleryKindBadge } from './GalleryKindBadge'
import { GalleryMediaMeta } from './GalleryMediaMeta'
import { GalleryPresentButton } from './GalleryPresentButton'
import { useClickOrDoubleClick } from '../hooks/useClickOrDoubleClick'

interface GalleryItemCardProps {
  media: BackgroundMedia
  /** On the screens now: the card gets the live outline */
  isLive: boolean
  /** Shown only when there is something to delete with (displays.edit) */
  onDelete?: () => void
  /** Shown only for someone who may present (control_room.control) */
  onPresent?: () => void
  onPreview: () => void
}

/**
 * One uploaded file: its thumbnail opens the preview, a double-click on it or
 * the present button puts it on the screens, trash deletes it.
 */
export function GalleryItemCard({
  media,
  isLive,
  onDelete,
  onPresent,
  onPreview,
}: GalleryItemCardProps) {
  const { t } = useTranslation('gallery')
  const handleThumbnailClick = useClickOrDoubleClick(onPreview, onPresent)

  return (
    <div
      data-testid="gallery-item"
      data-media-id={media.id}
      data-kind={media.kind}
      data-live={isLive || undefined}
      className={`group overflow-hidden rounded-xl border ${
        isLive ? 'border-live bg-live-tint' : 'border-line bg-panel'
      }`}
    >
      <div className="relative aspect-video bg-black">
        <button
          type="button"
          onClick={handleThumbnailClick}
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
      <div className="flex min-h-10 items-center justify-between gap-2 py-1 pr-1 pl-2.5">
        <GalleryMediaMeta media={media} className="text-fg-hint" />
        {onPresent && (
          <GalleryPresentButton
            onPresent={onPresent}
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          />
        )}
      </div>
    </div>
  )
}
