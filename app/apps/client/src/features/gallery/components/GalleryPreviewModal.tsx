import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { BackgroundMedia } from '~/features/background-media/service/types'
import { resolveMediaUrl } from '~/features/background-media/utils/resolveMediaUrl'
import { GalleryKindBadge } from './GalleryKindBadge'
import { GalleryMediaMeta } from './GalleryMediaMeta'

interface GalleryPreviewModalProps {
  /** The file to show; null keeps the dialog closed */
  media: BackgroundMedia | null
  onClose: () => void
}

/**
 * The file at full size — a native dialog, so Esc closes it and the app's
 * page shortcuts stay out of the way while it is open.
 */
export function GalleryPreviewModal({
  media,
  onClose,
}: GalleryPreviewModalProps) {
  const { t } = useTranslation('gallery')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (media && !dialog.open) dialog.showModal()
    if (!media && dialog.open) dialog.close()
  }, [media])

  // Close on a click on the backdrop, but not when a drag that started inside
  // (e.g. on the video's seek bar) ends outside.
  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (
      event.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  const src = media ? resolveMediaUrl(media.url) : ''

  return (
    <dialog
      ref={dialogRef}
      data-testid="gallery-preview-modal"
      aria-label={t('item.preview')}
      onClose={onClose}
      onMouseDown={(event) => {
        mouseDownTargetRef.current = event.target
      }}
      onClick={handleClick}
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-5xl overflow-hidden rounded-lg bg-gray-950 p-0 text-white shadow-2xl backdrop:bg-black/80"
    >
      {media && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <GalleryKindBadge kind={media.kind} />
              <GalleryMediaMeta media={media} className="text-gray-300" />
            </div>
            <button
              type="button"
              data-testid="gallery-preview-close"
              onClick={onClose}
              aria-label={t('preview.close')}
              title={t('preview.close')}
              className="shrink-0 rounded p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center justify-center bg-black">
            {media.kind === 'video' ? (
              <video
                key={media.id}
                src={src}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="max-h-[75vh] w-full object-contain"
              />
            ) : (
              <img
                src={src}
                alt=""
                draggable={false}
                className="max-h-[75vh] max-w-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
