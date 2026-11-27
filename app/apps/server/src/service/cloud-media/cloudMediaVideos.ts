import { getSetting } from '../settings'

/**
 * This PC's choice to publish background videos for phones too (they can be
 * large; images always go): an app setting of its own, never synced, set
 * through the settings API.
 */
export const CLOUD_MEDIA_VIDEOS_KEY = 'cloud_media_videos'

export function publishesCloudVideos(): boolean {
  return getSetting('app_settings', CLOUD_MEDIA_VIDEOS_KEY)?.value === 'true'
}
