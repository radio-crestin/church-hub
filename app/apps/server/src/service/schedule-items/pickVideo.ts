import type { ScheduleVideoPick, VideoItemConfig } from './types'
import {
  BACKGROUND_MEDIA_URL_PREFIX,
  listBackgroundVideoIds,
} from '../background-media'

/** The video a video item shows this time; null when the library has none. */
export function pickVideo(config: VideoItemConfig): ScheduleVideoPick | null {
  const ids = listBackgroundVideoIds()
  const mediaId =
    config.source === 'file'
      ? ids.find((id) => id === config.mediaId)
      : ids[Math.floor(Math.random() * ids.length)]
  if (!mediaId) return null
  return { mediaId, url: `${BACKGROUND_MEDIA_URL_PREFIX}/${mediaId}` }
}
