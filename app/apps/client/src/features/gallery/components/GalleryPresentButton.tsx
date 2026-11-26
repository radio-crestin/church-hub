import { MonitorPlay } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Tooltip } from '~/ui/tooltip'

interface GalleryPresentButtonProps {
  onPresent: () => void
  className?: string
}

/** The icon button that puts a gallery file full screen on the displays. */
export function GalleryPresentButton({
  onPresent,
  className = '',
}: GalleryPresentButtonProps) {
  const { t } = useTranslation('gallery')

  return (
    <Tooltip content={t('item.present')} className={className}>
      <button
        type="button"
        data-testid="gallery-item-present"
        onClick={onPresent}
        aria-label={t('item.present')}
        className="inline-flex size-8 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus pointer-coarse:size-11"
      >
        <MonitorPlay className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
