import { youtubeApiFetch } from './client'
import { getYouTubeConfig } from './config'
import { copyThumbnail } from './copy-thumbnail'
import { refreshTitleDate } from './refresh-title-date'
import { getDatabase } from '../../../db'
import { broadcastHistory } from '../../../db/schema'
import type { BroadcastInfo, YouTubeConfig } from '../types'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && process.env.DEBUG !== 'true') return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [youtube-broadcast] ${message}`)
}

/**
 * Runs one of the steps after the broadcast exists. A failed one is logged
 * and skipped: the stream still starts, without that setting.
 */
async function optionalStep(name: string, step: () => Promise<unknown>) {
  try {
    await step()
  } catch (error) {
    log(
      'error',
      `${name} failed: ${error instanceof Error ? error.message : error}`,
    )
  }
}

/** Category and tags live on the broadcast's video, set with videos.update. */
async function setVideoDetails(
  videoId: string,
  title: string,
  config: YouTubeConfig,
) {
  let categoryId = config.categoryId
  if (!categoryId) {
    // videos.update needs a category with the snippet: keep the video's own.
    const video = await youtubeApiFetch<{
      items?: { snippet?: { categoryId?: string } }[]
    }>('videos', { part: 'snippet', id: videoId })
    categoryId = video.items?.[0]?.snippet?.categoryId
  }
  await youtubeApiFetch(
    'videos',
    { part: 'snippet' },
    {
      method: 'PUT',
      body: JSON.stringify({
        id: videoId,
        snippet: {
          title,
          description: config.description,
          categoryId,
          tags: config.tags,
        },
      }),
    },
  )
}

/**
 * Creates the YouTube broadcast with every setting of the YouTube settings
 * page: the title (its date moved to today), description, privacy, audience,
 * latency, DVR, auto-start/stop, stream key, category, tags, thumbnail and
 * playlist.
 */
export async function createBroadcast(): Promise<BroadcastInfo> {
  const config = await getYouTubeConfig()
  const now = new Date()
  const title = refreshTitleDate(config.titleTemplate, now)
  log('info', `Creating broadcast "${title}"`)

  const { id: broadcastId } = await youtubeApiFetch<{ id: string }>(
    'liveBroadcasts',
    { part: 'snippet,status,contentDetails' },
    {
      method: 'POST',
      body: JSON.stringify({
        snippet: {
          title,
          description: config.description,
          scheduledStartTime: now.toISOString(),
        },
        status: {
          privacyStatus: config.privacyStatus,
          selfDeclaredMadeForKids: config.madeForKids,
        },
        contentDetails: {
          enableAutoStart: config.enableAutoStart,
          enableAutoStop: config.enableAutoStop,
          enableDvr: config.enableDvr,
          latencyPreference: config.latencyPreference,
        },
      }),
    },
  )

  if (config.streamKeyId) {
    log('info', `Binding broadcast ${broadcastId} to ${config.streamKeyId}`)
    await youtubeApiFetch(
      'liveBroadcasts/bind',
      {
        id: broadcastId,
        part: 'id,contentDetails',
        streamId: config.streamKeyId,
      },
      { method: 'POST' },
    )
  } else {
    log('warning', 'No stream key set: the broadcast has no stream bound')
  }

  if (config.categoryId || config.tags.length) {
    await optionalStep('Setting the category and tags', () =>
      setVideoDetails(broadcastId, title, config),
    )
  }
  const { thumbnailUrl, playlistId } = config
  if (thumbnailUrl) {
    await optionalStep('Setting the thumbnail', () =>
      copyThumbnail(broadcastId, thumbnailUrl),
    )
  }
  if (playlistId) {
    await optionalStep('Adding to the playlist', () =>
      youtubeApiFetch(
        'playlistItems',
        { part: 'snippet' },
        {
          method: 'POST',
          body: JSON.stringify({
            snippet: {
              playlistId,
              resourceId: { kind: 'youtube#video', videoId: broadcastId },
            },
          }),
        },
      ),
    )
  }

  const url = `https://youtu.be/${broadcastId}`
  await getDatabase().insert(broadcastHistory).values({
    broadcastId,
    title,
    scheduledStartTime: now,
    url,
    status: 'scheduled',
  })

  return {
    broadcastId,
    title,
    url,
    status: 'scheduled',
    scheduledStartTime: now,
  }
}
