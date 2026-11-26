import type { Bindings } from '../types'
import { createR2ScreenshotStore } from './createR2ScreenshotStore'
import { createS3ScreenshotStore } from './createS3ScreenshotStore'
import type { ScreenshotStore } from './screenshotStore'

/**
 * The one place that decides which storage holds feature-request
 * screenshots: an R2 binding when the Worker has one, otherwise the S3
 * bucket of the S3_* settings (the default, and the only one off Cloudflare).
 * Null when neither is configured: requests are then sent without their
 * screenshot instead of failing.
 */
export function getScreenshotStore(env: Bindings): ScreenshotStore | null {
  if (env.FEATURE_REQUEST_SCREENSHOTS) {
    return createR2ScreenshotStore(env.FEATURE_REQUEST_SCREENSHOTS)
  }
  return hasS3Storage(env) ? createS3ScreenshotStore(env) : null
}

function hasS3Storage(env: Bindings): boolean {
  const bucket =
    env.FEATURE_REQUEST_S3_BUCKET || env.S3_STATE_BUCKET || env.S3_BUCKET
  return Boolean(
    env.S3_ENDPOINT && bucket && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
  )
}
