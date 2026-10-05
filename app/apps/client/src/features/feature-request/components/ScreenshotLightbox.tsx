import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ScreenshotLightboxProps {
  src: string
  onClose: () => void
}

/**
 * The marked-up screenshot as large as the window allows. A click anywhere
 * or Escape closes it, and Escape does not close the request dialog too.
 */
export function ScreenshotLightbox({ src, onClose }: ScreenshotLightboxProps) {
  const { t } = useTranslation()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return (
    <div
      data-testid="feature-request-lightbox"
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8 cursor-zoom-out"
    >
      <img
        src={src}
        alt={t('common:featureRequest.previewAlt')}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
      />
      <button
        ref={closeRef}
        type="button"
        data-testid="feature-request-lightbox-close"
        aria-label={t('common:featureRequest.closePreview')}
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }}
        className="absolute top-3 right-3 flex items-center justify-center w-10 h-10 rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X size={22} />
      </button>
    </div>
  )
}
