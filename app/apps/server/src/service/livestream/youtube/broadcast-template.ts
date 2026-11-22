import { youtubeApiFetch } from './client'
import type { YouTubeConfig } from '../types'

/** The settings a past broadcast lends the YouTube settings when picked as the template. */
export type BroadcastTemplate = Pick<
  YouTubeConfig,
  | 'selectedBroadcastId'
  | 'titleTemplate'
  | 'description'
  | 'privacyStatus'
  | 'streamKeyId'
  | 'categoryId'
  | 'tags'
  | 'madeForKids'
  | 'latencyPreference'
  | 'enableAutoStart'
  | 'enableAutoStop'
  | 'thumbnailUrl'
>

interface Thumbnails {
  maxres?: { url?: string }
  standard?: { url?: string }
  high?: { url?: string }
}

interface BroadcastResponse {
  items?: {
    snippet?: { title?: string; description?: string }
    status?: { privacyStatus?: YouTubeConfig['privacyStatus'] }
    contentDetails?: {
      boundStreamId?: string
      latencyPreference?: YouTubeConfig['latencyPreference']
      enableAutoStart?: boolean
      enableAutoStop?: boolean
    }
  }[]
}

interface VideoResponse {
  items?: {
    snippet?: { categoryId?: string; tags?: string[]; thumbnails?: Thumbnails }
    status?: { madeForKids?: boolean }
  }[]
}

/**
 * Reads a past broadcast's settings: title, description, privacy, stream
 * key, latency, auto-start/stop (the broadcast), category, tags, audience
 * and thumbnail (its video). DVR is not copied: it stays the operator's
 * choice, off by default.
 */
export async function getBroadcastTemplate(
  broadcastId: string,
): Promise<BroadcastTemplate> {
  const [broadcasts, videos] = await Promise.all([
    youtubeApiFetch<BroadcastResponse>('liveBroadcasts', {
      part: 'snippet,status,contentDetails',
      id: broadcastId,
    }),
    youtubeApiFetch<VideoResponse>('videos', {
      part: 'snippet,status',
      id: broadcastId,
    }),
  ])
  const broadcast = broadcasts.items?.[0]
  if (!broadcast) throw new Error(`Broadcast ${broadcastId} not found`)
  const video = videos.items?.[0]
  const thumbnails = video?.snippet?.thumbnails
  const details = broadcast.contentDetails

  return {
    selectedBroadcastId: broadcastId,
    titleTemplate: broadcast.snippet?.title ?? '',
    description: broadcast.snippet?.description ?? '',
    privacyStatus: broadcast.status?.privacyStatus ?? 'unlisted',
    streamKeyId: details?.boundStreamId,
    categoryId: video?.snippet?.categoryId,
    tags: video?.snippet?.tags ?? [],
    madeForKids: video?.status?.madeForKids ?? false,
    latencyPreference: details?.latencyPreference ?? 'normal',
    enableAutoStart: details?.enableAutoStart ?? true,
    enableAutoStop: details?.enableAutoStop ?? true,
    thumbnailUrl:
      thumbnails?.maxres?.url ??
      thumbnails?.standard?.url ??
      thumbnails?.high?.url,
  }
}
