import type { Bindings } from '../types'
import { createR2ScreenshotStore } from './createR2ScreenshotStore'
import type { ScreenshotStore } from './screenshotStore'

/** The one place that decides which storage holds feature-request screenshots. */
export function getScreenshotStore(env: Bindings): ScreenshotStore {
  return createR2ScreenshotStore(env.FEATURE_REQUEST_SCREENSHOTS)
}
