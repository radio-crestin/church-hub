import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl, isMobile, isTauri } from '~/config'
import { getAuthHeaders } from '~/utils/getAuthHeaders'
import { createLogger } from '~/utils/logger'
import { BackgroundMediaUploadError } from './BackgroundMediaUploadError'
import type { BackgroundMedia, BackgroundMediaErrorCode } from './types'
import { getBackgroundMediaMimeType } from '../utils/getBackgroundMediaMimeType'

const logger = createLogger('app:background-media')

// Same transport as every other API call: the Tauri HTTP plugin on mobile
// (iOS WKWebView blocks plain-HTTP fetch), the webview's own fetch elsewhere.
const fetchFn = isTauri() && isMobile() ? tauriFetch : window.fetch.bind(window)

const STATUS_ERROR_CODES: Record<number, BackgroundMediaErrorCode> = {
  413: 'fileTooLarge',
  415: 'unsupportedType',
}

/**
 * Uploads an image or video as the raw request body.
 *
 * Not routed through `fetcher`: its 15 s timeout would abort a large video
 * mid-upload, and the refusal reason has to come from the response status.
 */
export async function uploadBackgroundMedia(
  file: File,
): Promise<BackgroundMedia> {
  const apiUrl = getApiUrl()
  if (!apiUrl) {
    throw new BackgroundMediaUploadError(
      'uploadFailed',
      'API URL is not configured',
    )
  }

  logger.debug(`Uploading ${file.name} (${file.size} bytes)`)

  const response = await fetchFn(
    `${apiUrl}/api/media/backgrounds?name=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': getBackgroundMediaMimeType(file),
      },
      body: file,
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    logger.error(
      `Upload of ${file.name} failed (${response.status}): ${detail}`,
    )
    throw new BackgroundMediaUploadError(
      STATUS_ERROR_CODES[response.status] ?? 'uploadFailed',
      `Upload failed with status ${response.status}`,
    )
  }

  const result: { data?: BackgroundMedia } = await response.json()
  if (!result.data) {
    throw new BackgroundMediaUploadError(
      'uploadFailed',
      'Upload response has no data',
    )
  }
  return result.data
}
