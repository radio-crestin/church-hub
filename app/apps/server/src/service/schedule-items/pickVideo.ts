import { join } from 'node:path'

import type { ScheduleVideoPick, VideoItemConfig } from './types'
import {
  BACKGROUND_MEDIA_URL_PREFIX,
  getBackgroundMediaDir,
  listBackgroundVideoIds,
} from '../background-media'
import { readMp4Seconds } from '../background-media/readMp4Seconds'

/** The video a video item shows this time; null when the library has none. */
export function pickVideo(config: VideoItemConfig): ScheduleVideoPick | null {
  const ids = listBackgroundVideoIds()
  const mediaId =
    config.source === 'file'
      ? ids.find((id) => id === config.mediaId)
      : ids[Math.floor(Math.random() * ids.length)]
  if (!mediaId) return null
  return {
    mediaId,
    url: `${BACKGROUND_MEDIA_URL_PREFIX}/${mediaId}`,
    seconds: mediaId.endsWith('.mp4')
      ? readMp4Seconds(join(getBackgroundMediaDir(), mediaId))
      : null,
  }
}
