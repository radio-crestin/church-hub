import { MonitorPlay, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaUrl } from '~/features/background-media/hooks/useMediaUrl'
import type { BackgroundMedia } from '~/features/background-media/service/types'
import { Button } from '~/ui/button'
import { GalleryKindBadge } from './GalleryKindBadge'
import { GalleryMediaMeta } from './GalleryMediaMeta'

interface GalleryPreviewModalProps {
  /** The file to show; null keeps the dialog closed */
  media: BackgroundMedia | null
  onClose: () => void
  /** Shown only for someone who may present (control_room.control) */
  onPresent?: (media: BackgroundMedia) => void
}

/**
 * The file at full size — a native dialog, so Esc closes it and the app's
 * page shortcuts stay out of the way while it is open.
 */
export function GalleryPreviewModal({
  media,
  onClose,
  onPresent,
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

  const src = useMediaUrl(media?.url).src ?? ''

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
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-5xl overflow-hidden rounded-xl bg-black p-0 text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop:bg-black/80"
    >
      {media && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <GalleryKindBadge kind={media.kind} />
              <GalleryMediaMeta media={media} className="text-white/70" />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onPresent && (
                <Button
                  type="button"
                  size="sm"
                  data-testid="gallery-preview-present"
                  onClick={() => {
                    onPresent(media)
                    onClose()
                  }}
                  className="pointer-coarse:h-11"
                >
                  <MonitorPlay
                    className="size-4"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  {t('preview.present')}
                </Button>
              )}
              <button
                type="button"
                data-testid="gallery-preview-close"
                onClick={onClose}
                aria-label={t('preview.close')}
                title={t('preview.close')}
                className="shrink-0 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white pointer-coarse:p-3.5"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
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
