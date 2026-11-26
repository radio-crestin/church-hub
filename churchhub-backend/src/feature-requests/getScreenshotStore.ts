import type { Bindings } from '../types'
import { createR2ScreenshotStore } from './createR2ScreenshotStore'
import { createS3ScreenshotStore } from './createS3ScreenshotStore'
import type { ScreenshotStore } from './screenshotStore'

/**
 * The one place that decides which storage holds feature-request
 * screenshots: an R2 binding when the Worker has one, otherwise the S3
 * bucket of the S3_* settings (the default, and the only one off Cloudflare).
 */
export function getScreenshotStore(env: Bindings): ScreenshotStore {
  return env.FEATURE_REQUEST_SCREENSHOTS
    ? createR2ScreenshotStore(env.FEATURE_REQUEST_SCREENSHOTS)
    : createS3ScreenshotStore(env)
}
