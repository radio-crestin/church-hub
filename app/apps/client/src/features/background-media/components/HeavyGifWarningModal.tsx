import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { formatFileSize } from '~/utils/formatFileSize'
import type { HeavyAnimatedGif } from '../utils/findHeavyAnimatedGifs'

interface HeavyGifWarningModalProps {
  /** The GIFs to warn about; the modal is open while there are any */
  gifs: HeavyAnimatedGif[]
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Warns that the picked animated GIFs may play choppy or freeze on screens and
 * recommends an MP4 or WebM video instead, listing each GIF with its size and
 * frame count. "Upload anyway" uploads them, Cancel uploads nothing.
 */
export function HeavyGifWarningModal({
  gifs,
  onConfirm,
  onCancel,
}: HeavyGifWarningModalProps) {
  const { t, i18n } = useTranslation('presentation')
  const count = gifs.length

  return (
    <ConfirmModal
      isOpen={count > 0}
      testId="heavy-gif-warning"
      title={t('screens.background.heavyGif.title', { count })}
      message={t('screens.background.heavyGif.message', { count })}
      confirmLabel={t('screens.background.heavyGif.confirm')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {gifs.map((gif) => (
          <li
            // One pick comes from one folder, so names are unique.
            key={gif.name}
            data-testid="heavy-gif-warning-item"
            className="min-w-0 rounded-md bg-amber-50 px-3 py-2 text-sm dark:bg-amber-900/20"
          >
            <p className="truncate font-medium text-gray-900 dark:text-white">
              {gif.name}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {t('screens.background.heavyGif.details', {
                size: formatFileSize(gif.size, i18n.language),
                count: gif.frameCount,
              })}
            </p>
          </li>
        ))}
      </ul>
    </ConfirmModal>
  )
}
