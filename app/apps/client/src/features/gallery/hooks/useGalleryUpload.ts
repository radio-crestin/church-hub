import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUploadBackgroundMedia } from '~/features/background-media/hooks'
import { BackgroundMediaUploadError } from '~/features/background-media/service'
import { validateBackgroundMediaFile } from '~/features/background-media/utils/validateBackgroundMediaFile'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import type { GalleryUploadProgress } from '../types'

const logger = createLogger('app:gallery')

/**
 * Uploads picked files one after another — a video can be up to 1 GB, so they
 * are not sent in parallel. Each refused or failed file gets its own error
 * toast and the rest carry on; a summary toast reports how many made it. The
 * list refreshes after every upload through the upload hook's invalidation.
 */
export function useGalleryUpload() {
  const { t } = useTranslation('gallery')
  const { showToast } = useToast()
  const { mutateAsync: upload } = useUploadBackgroundMedia()
  const [progress, setProgress] = useState<GalleryUploadProgress | null>(null)

  const uploadFiles = async (files: File[]) => {
    let uploaded = 0

    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length })

      const refusal = validateBackgroundMediaFile(file)
      if (refusal) {
        showToast(t(`upload.errors.${refusal}`, { name: file.name }), 'error')
        continue
      }

      try {
        await upload(file)
        uploaded++
      } catch (error) {
        // Report this file and move on to the next one.
        logger.error(`Upload of ${file.name} failed`, error)
        const code =
          error instanceof BackgroundMediaUploadError
            ? error.code
            : 'uploadFailed'
        showToast(t(`upload.errors.${code}`, { name: file.name }), 'error')
      }
    }

    setProgress(null)
    if (uploaded > 0) {
      showToast(t('upload.success', { count: uploaded }), 'success')
    }
  }

  return { uploadFiles, progress }
}
