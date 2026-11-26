import { useTranslation } from 'react-i18next'

import type { BackgroundMedia } from '~/features/background-media/service/types'
import { usePresentGalleryMedia } from '~/features/presentation/hooks/usePresentationControls'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:gallery:present')

/** Puts a gallery file full screen on the displays; a failure shows a toast. */
export function usePresentGalleryItem() {
  const { t } = useTranslation('gallery')
  const { showToast } = useToast()
  const present = usePresentGalleryMedia()

  return (media: BackgroundMedia) =>
    present.mutate(
      { kind: media.kind, mediaId: media.id },
      {
        onError: (error) => {
          logger.error(`Presenting ${media.id} failed`, error)
          showToast(t('present.failed'), 'error')
        },
      },
    )
}
