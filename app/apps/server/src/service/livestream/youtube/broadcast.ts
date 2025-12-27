import { eq } from 'drizzle-orm'

import { getYouTubeService, youtubeApiFetch } from './client'
import { getYouTubeConfig } from './config'
import { getDatabase } from '../../../db'
import { broadcastHistory } from '../../../db/schema'
import type { BroadcastInfo, PastBroadcast, UpcomingBroadcast } from '../types'

// YouTube API response types for direct fetch calls
interface YouTubeBroadcastItem {
  id: string
  snippet?: {
    title?: string
    description?: string
    scheduledStartTime?: string
    actualStartTime?: string
    actualEndTime?: string
  }
  status?: {
    lifeCycleStatus?: string
    privacyStatus?: string
    streamStatus?: string
  }
}

interface YouTubeBroadcastListResponse {
  items?: YouTubeBroadcastItem[]
}

interface YouTubeStreamItem {
  id: string
  snippet?: {
    title?: string
  }
}

interface YouTubeStreamListResponse {
  items?: YouTubeStreamItem[]
}

export async function createBroadcast(): Promise<BroadcastInfo> {
  const youtube = await getYouTubeService()
  const config = await getYouTubeConfig()
  const now = new Date()

  let broadcastId: string

  if (youtube) {
    const broadcastResponse = await youtube.liveBroadcasts.insert({
      part: ['snippet', 'status', 'contentDetails'],
      requestBody: {
        snippet: {
          title: config.titleTemplate,
          description: config.description,
          scheduledStartTime: now.toISOString(),
        },
        status: {
          privacyStatus: config.privacyStatus,
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
          latencyPreference: 'normal',
        },
      },
    })

    broadcastId = broadcastResponse.data.id!

    if (config.streamKeyId) {
      await youtube.liveBroadcasts.bind({
        id: broadcastId,
        part: ['id', 'contentDetails'],
        streamId: config.streamKeyId,
      })
    }

    if (config.playlistId) {
      try {
        await youtube.playlistItems.insert({
          part: ['snippet'],
          requestBody: {
            snippet: {
              playlistId: config.playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId: broadcastId,
              },
            },
          },
        })
      } catch {
        // Failed to add to playlist, continue silently
      }
    }
  } else {
    // Fallback to direct API fetch
    const broadcastResponse = await youtubeApiFetch<{ id: string }>(
      'liveBroadcasts',
      { part: 'snippet,status,contentDetails' },
      {
        method: 'POST',
        body: JSON.stringify({
          snippet: {
            title: config.titleTemplate,
            description: config.description,
            scheduledStartTime: now.toISOString(),
          },
          status: {
            privacyStatus: config.privacyStatus,
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            latencyPreference: 'normal',
          },
        }),
      },
    )

    broadcastId = broadcastResponse.id

    if (config.streamKeyId) {
      await youtubeApiFetch(
        'liveBroadcasts/bind',
        {
          id: broadcastId,
          part: 'id,contentDetails',
          streamId: config.streamKeyId,
        },
        { method: 'POST' },
      )
    }

    if (config.playlistId) {
      try {
        await youtubeApiFetch(
          'playlistItems',
          { part: 'snippet' },
          {
            method: 'POST',
            body: JSON.stringify({
              snippet: {
                playlistId: config.playlistId,
                resourceId: {
                  kind: 'youtube#video',
                  videoId: broadcastId,
                },
              },
            }),
          },
        )
      } catch {
        // Failed to add to playlist, continue silently
      }
    }
  }

  const url = `https://youtu.be/${broadcastId}`

  const db = getDatabase()
  await db.insert(broadcastHistory).values({
    broadcastId,
    title: config.titleTemplate,
    scheduledStartTime: now,
    url,
    status: 'scheduled',
  })

  return {
    broadcastId,
    title: config.titleTemplate,
    url,
    status: 'scheduled',
    scheduledStartTime: now,
  }
}

// Cache for active broadcast to avoid repeated API calls
let activeBroadcastCache: {
  data: BroadcastInfo | null
  timestamp: number
} | null = null
const ACTIVE_BROADCAST_CACHE_TTL = 10 * 1000 // 10 seconds

export async function getActiveBroadcast(): Promise<BroadcastInfo | null> {
  // Return cached result if still fresh
  if (
    activeBroadcastCache &&
    Date.now() - activeBroadcastCache.timestamp < ACTIVE_BROADCAST_CACHE_TTL
  ) {
    return activeBroadcastCache.data
  }

  const youtube = await getYouTubeService()

  // If not authenticated, return null immediately without making API calls
  if (!youtube) {
    activeBroadcastCache = { data: null, timestamp: Date.now() }
    return null
  }

  try {
    const response = await youtube.liveBroadcasts.list({
      part: ['snippet', 'status'],
      broadcastStatus: 'active',
    })

    const broadcast = response.data.items?.[0]
    if (!broadcast) {
      const upcomingResponse = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        broadcastStatus: 'upcoming',
      })

      const upcomingBroadcast = upcomingResponse.data.items?.[0]
      if (!upcomingBroadcast) {
        activeBroadcastCache = { data: null, timestamp: Date.now() }
        return null
      }

      const result: BroadcastInfo = {
        broadcastId: upcomingBroadcast.id!,
        title: upcomingBroadcast.snippet?.title || '',
        url: `https://youtu.be/${upcomingBroadcast.id}`,
        status: 'scheduled',
        scheduledStartTime: new Date(
          upcomingBroadcast.snippet?.scheduledStartTime || Date.now(),
        ),
      }
      activeBroadcastCache = { data: result, timestamp: Date.now() }
      return result
    }

    const result: BroadcastInfo = {
      broadcastId: broadcast.id!,
      title: broadcast.snippet?.title || '',
      url: `https://youtu.be/${broadcast.id}`,
      status: 'live',
      scheduledStartTime: new Date(
        broadcast.snippet?.scheduledStartTime || Date.now(),
      ),
      actualStartTime: broadcast.snippet?.actualStartTime
        ? new Date(broadcast.snippet.actualStartTime)
        : undefined,
    }
    activeBroadcastCache = { data: result, timestamp: Date.now() }
    return result
  } catch {
    activeBroadcastCache = { data: null, timestamp: Date.now() }
    return null
  }
}

// Clear the cache when broadcast status changes (start/stop)
export function clearActiveBroadcastCache(): void {
  activeBroadcastCache = null
}

export async function endBroadcast(broadcastId: string): Promise<void> {
  const youtube = await getYouTubeService()

  try {
    if (youtube) {
      await youtube.liveBroadcasts.transition({
        id: broadcastId,
        broadcastStatus: 'complete',
        part: ['id', 'status'],
      })
    } else {
      // Fallback to direct API fetch
      await youtubeApiFetch(
        'liveBroadcasts/transition',
        {
          id: broadcastId,
          broadcastStatus: 'complete',
          part: 'id,status',
        },
        { method: 'POST' },
      )
    }
    // biome-ignore lint/suspicious/noConsole: logging
    console.log(
      `[youtube-broadcast] Successfully ended broadcast ${broadcastId}`,
    )
  } catch (error) {
    // Log the error but continue with updating local status
    // This can happen if YouTube already auto-stopped the broadcast
    // biome-ignore lint/suspicious/noConsole: logging
    console.log(
      `[youtube-broadcast] Failed to transition broadcast ${broadcastId} to complete:`,
      error instanceof Error ? error.message : error,
    )
  }

  const db = getDatabase()
  await db
    .update(broadcastHistory)
    .set({
      status: 'ended',
      endTime: new Date(),
    })
    .where(eq(broadcastHistory.broadcastId, broadcastId))
}

export async function deleteUpcomingBroadcasts(): Promise<void> {
  const youtube = await getYouTubeService()
  const db = getDatabase()

  if (youtube) {
    const response = await youtube.liveBroadcasts.list({
      part: ['id'],
      broadcastStatus: 'upcoming',
    })

    const broadcasts = response.data.items || []

    for (const broadcast of broadcasts) {
      try {
        await youtube.liveBroadcasts.delete({ id: broadcast.id! })

        await db
          .update(broadcastHistory)
          .set({ status: 'deleted' })
          .where(eq(broadcastHistory.broadcastId, broadcast.id!))
      } catch {
        // Failed to delete broadcast, continue with next
      }
    }
  } else {
    // Fallback to direct API fetch
    const response = await youtubeApiFetch<YouTubeBroadcastListResponse>(
      'liveBroadcasts',
      {
        part: 'id',
        broadcastStatus: 'upcoming',
      },
    )

    const broadcasts = response.items || []

    for (const broadcast of broadcasts) {
      try {
        await youtubeApiFetch(
          'liveBroadcasts',
          { id: broadcast.id },
          { method: 'DELETE' },
        )

        await db
          .update(broadcastHistory)
          .set({ status: 'deleted' })
          .where(eq(broadcastHistory.broadcastId, broadcast.id))
      } catch {
        // Failed to delete broadcast, continue with next
      }
    }
  }
}

export async function getStreamKeys(): Promise<{ id: string; name: string }[]> {
  const youtube = await getYouTubeService()

  if (youtube) {
    const response = await youtube.liveStreams.list({
      part: ['id', 'snippet'],
      mine: true,
    })

    return (response.data.items || []).map((stream) => ({
      id: stream.id!,
      name: stream.snippet?.title || stream.id!,
    }))
  }

  // Fallback to direct API fetch
  const response = await youtubeApiFetch<YouTubeStreamListResponse>(
    'liveStreams',
    {
      part: 'id,snippet',
      mine: 'true',
    },
  )

  return (response.items || []).map((stream) => ({
    id: stream.id,
    name: stream.snippet?.title || stream.id,
  }))
}

export async function getUpcomingBroadcasts(): Promise<UpcomingBroadcast[]> {
  const youtube = await getYouTubeService()

  if (youtube) {
    const response = await youtube.liveBroadcasts.list({
      part: ['id', 'snippet', 'status'],
      broadcastStatus: 'upcoming',
      maxResults: 25,
    })

    return (response.data.items || []).map((broadcast) => ({
      broadcastId: broadcast.id!,
      title: broadcast.snippet?.title || '',
      scheduledStartTime: new Date(
        broadcast.snippet?.scheduledStartTime || Date.now(),
      ),
      privacyStatus: (broadcast.status?.privacyStatus || 'unlisted') as
        | 'public'
        | 'unlisted'
        | 'private',
      url: `https://youtu.be/${broadcast.id}`,
    }))
  }

  // Fallback to direct API fetch
  const response = await youtubeApiFetch<YouTubeBroadcastListResponse>(
    'liveBroadcasts',
    {
      part: 'id,snippet,status',
      broadcastStatus: 'upcoming',
      maxResults: '25',
    },
  )

  return (response.items || []).map((broadcast) => ({
    broadcastId: broadcast.id,
    title: broadcast.snippet?.title || '',
    scheduledStartTime: new Date(
      broadcast.snippet?.scheduledStartTime || Date.now(),
    ),
    privacyStatus: (broadcast.status?.privacyStatus || 'unlisted') as
      | 'public'
      | 'unlisted'
      | 'private',
    url: `https://youtu.be/${broadcast.id}`,
  }))
}

export async function getPastBroadcasts(): Promise<PastBroadcast[]> {
  const youtube = await getYouTubeService()

  if (youtube) {
    const response = await youtube.liveBroadcasts.list({
      part: ['id', 'snippet', 'status'],
      broadcastStatus: 'completed',
      maxResults: 10,
    })

    return (response.data.items || []).map((broadcast) => ({
      broadcastId: broadcast.id!,
      title: broadcast.snippet?.title || '',
      description: broadcast.snippet?.description || '',
      privacyStatus: (broadcast.status?.privacyStatus || 'unlisted') as
        | 'public'
        | 'unlisted'
        | 'private',
      completedAt: new Date(
        broadcast.snippet?.actualEndTime ||
          broadcast.snippet?.actualStartTime ||
          Date.now(),
      ),
    }))
  }

  // Fallback to direct API fetch when OAuth credentials not configured
  const response = await youtubeApiFetch<YouTubeBroadcastListResponse>(
    'liveBroadcasts',
    {
      part: 'id,snippet,status',
      broadcastStatus: 'completed',
      maxResults: '10',
    },
  )

  return (response.items || []).map((broadcast) => ({
    broadcastId: broadcast.id,
    title: broadcast.snippet?.title || '',
    description: broadcast.snippet?.description || '',
    privacyStatus: (broadcast.status?.privacyStatus || 'unlisted') as
      | 'public'
      | 'unlisted'
      | 'private',
    completedAt: new Date(
      broadcast.snippet?.actualEndTime ||
        broadcast.snippet?.actualStartTime ||
        Date.now(),
    ),
  }))
}

export async function getBroadcastStatus(broadcastId: string): Promise<{
  lifeCycleStatus: string
  streamStatus: string | null
}> {
  const youtube = await getYouTubeService()

  if (youtube) {
    const response = await youtube.liveBroadcasts.list({
      part: ['status'],
      id: [broadcastId],
    })

    const broadcast = response.data.items?.[0]
    if (!broadcast) {
      throw new Error(`Broadcast ${broadcastId} not found`)
    }

    return {
      lifeCycleStatus: broadcast.status?.lifeCycleStatus || 'unknown',
      streamStatus: broadcast.status?.streamStatus || null,
    }
  }

  // Fallback to direct API fetch
  const response = await youtubeApiFetch<YouTubeBroadcastListResponse>(
    'liveBroadcasts',
    {
      part: 'status',
      id: broadcastId,
    },
  )

  const broadcast = response.items?.[0]
  if (!broadcast) {
    throw new Error(`Broadcast ${broadcastId} not found`)
  }

  return {
    lifeCycleStatus: broadcast.status?.lifeCycleStatus || 'unknown',
    streamStatus: broadcast.status?.streamStatus || null,
  }
}

export interface WaitForReadyOptions {
  timeoutMs?: number
  pollIntervalMs?: number
  onProgress?: (status: { lifeCycleStatus: string; elapsedMs: number }) => void
}

export async function waitForBroadcastReady(
  broadcastId: string,
  options: WaitForReadyOptions = {},
): Promise<void> {
  const { timeoutMs = 60000, pollIntervalMs = 2000, onProgress } = options

  const startTime = Date.now()

  while (true) {
    const elapsedMs = Date.now() - startTime

    if (elapsedMs >= timeoutMs) {
      throw new Error(
        `Timeout waiting for broadcast ${broadcastId} to become ready after ${timeoutMs}ms`,
      )
    }

    const status = await getBroadcastStatus(broadcastId)

    if (onProgress) {
      onProgress({ lifeCycleStatus: status.lifeCycleStatus, elapsedMs })
    }

    if (
      status.lifeCycleStatus === 'ready' ||
      status.lifeCycleStatus === 'live'
    ) {
      return
    }

    if (
      status.lifeCycleStatus === 'complete' ||
      status.lifeCycleStatus === 'revoked'
    ) {
      throw new Error(
        `Broadcast ${broadcastId} is in unexpected state: ${status.lifeCycleStatus}`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
}
