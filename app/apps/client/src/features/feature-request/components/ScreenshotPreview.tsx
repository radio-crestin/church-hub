import { Maximize2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ScreenshotLightbox } from './ScreenshotLightbox'

interface ScreenshotPreviewProps {
  /** The screenshot with the markup flattened in, as a data URL. */
  src: string
  /** Goes back to step 1 to change the markup. */
  onEdit: () => void
}

const captionButton =
  'flex items-center gap-1 px-2 py-1 text-sm font-medium rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors'

/**
 * Step 2's view of what will be sent: the marked-up screenshot, big and
 * framed, keeping its shape. Clicking it opens it full screen.
 */
export function ScreenshotPreview({ src, onEdit }: ScreenshotPreviewProps) {
  const { t } = useTranslation()
  const [isEnlarged, setIsEnlarged] = useState(false)

  return (
    <figure className="flex flex-col gap-1.5 min-w-0">
      <button
        type="button"
        data-testid="feature-request-preview-open"
        aria-label={t('common:featureRequest.enlargePreview')}
        title={t('common:featureRequest.enlargePreview')}
        onClick={() => setIsEnlarged(true)}
        className="group relative flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-2 cursor-zoom-in"
      >
        <img
          src={src}
          alt={t('common:featureRequest.previewAlt')}
          data-testid="feature-request-preview"
          className="block w-auto h-auto max-w-full max-h-[30vh] sm:max-h-[40vh] rounded-lg shadow-sm"
        />
        <span className="absolute bottom-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-white opacity-80 group-hover:opacity-100 transition-opacity">
          <Maximize2 size={18} />
        </span>
      </button>
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t('common:featureRequest.previewCaption')}
        </span>
        <button
          type="button"
          data-testid="feature-request-preview-edit"
          onClick={onEdit}
          className={captionButton}
        >
          <Pencil size={14} />
          {t('common:featureRequest.editScreenshot')}
        </button>
      </figcaption>
      {isEnlarged && (
        <ScreenshotLightbox src={src} onClose={() => setIsEnlarged(false)} />
      )}
    </figure>
  )
}
