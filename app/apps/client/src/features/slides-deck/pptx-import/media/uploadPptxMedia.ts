import { BACKGROUND_MEDIA_MAX_BYTES } from '~/features/background-media/constants'
import { uploadBackgroundMedia } from '~/features/background-media/service'
import { createLogger } from '~/utils/logger'
import type { PptxPackage } from '../package/openPptxPackage'
import type { PptxMediaFile } from '../types'

const logger = createLogger('app:slides-deck:pptx-import')

/**
 * Uploads a deck's pictures and videos to the gallery, one after the other,
 * telling how many are done. Returns each token's gallery id, and the files
 * that were too large or failed (left out of the deck).
 */
export async function uploadPptxMedia(
  pkg: PptxPackage,
  files: PptxMediaFile[],
  onProgress: (done: number, total: number) => void,
): Promise<{
  uploaded: Map<string, string>
  tooLarge: string[]
  failed: string[]
}> {
  const uploaded = new Map<string, string>()
  const tooLarge: string[] = []
  const failed: string[] = []
  onProgress(0, files.length)
  for (const [index, media] of files.entries()) {
    const blob = await pkg.blob(media.path)
    if (!blob) {
      failed.push(media.fileName)
    } else if (blob.size > BACKGROUND_MEDIA_MAX_BYTES[media.kind]) {
      tooLarge.push(media.fileName)
    } else {
      try {
        const file = new File([blob], media.fileName, { type: media.mimeType })
        uploaded.set(media.token, (await uploadBackgroundMedia(file)).id)
      } catch (error) {
        logger.error(`Upload of ${media.path} failed`, error)
        failed.push(media.fileName)
      }
    }
    onProgress(index + 1, files.length)
  }
  return { uploaded, tooLarge, failed }
}
