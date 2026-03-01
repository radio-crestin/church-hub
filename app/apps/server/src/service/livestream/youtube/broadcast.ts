import { eq } from 'drizzle-orm'

import { getYouTubeService, youtubeApiFetch } from './client'
import { getYouTubeConfig } from './config'
import { getDatabase } from '../../../db'
import { broadcastHistory } from '../../../db/schema'
import type { BroadcastInfo, PastBroadcast, UpcomingBroadcast } from '../types'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [youtube-broadcast] ${message}`)
}

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

  log(
    'info',
    `Creating broadcast with config: streamKeyId=${config.streamKeyId || 'NOT SET'}, title=${config.titleTemplate}`,
  )

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
      log(
        'info',
        `Binding broadcast ${broadcastId} to stream key ${config.streamKeyId}`,
      )
      await youtube.liveBroadcasts.bind({
        id: broadcastId,
        part: ['id', 'contentDetails'],
        streamId: config.streamKeyId,
      })
      log('info', 'Stream key binding successful')
    } else {
      log(
        'warning',
        'No streamKeyId configured - broadcast will not have a stream key!',
      )
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
      log(
        'info',
        `Binding broadcast ${broadcastId} to stream key ${config.streamKeyId} (fallback API)`,
      )
      await youtubeApiFetch(
        'liveBroadcasts/bind',
        {
          id: broadcastId,
          part: 'id,contentDetails',
          streamId: config.streamKeyId,
        },
        { method: 'POST' },
      )
      log('info', 'Stream key binding successful (fallback API)')
    } else {
      log(
        'warning',
        'No streamKeyId configured - broadcast will not have a stream key! (fallback API)',
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

// The broadcast ID that our app created/is using for the current session.
// When set, getActiveBroadcast() will prefer this over whatever YouTube API returns.
let currentSessionBroadcastId: string | null = null

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

    const activeItems = response.data.items || []

    // If we have a session broadcast ID, prefer it over other active broadcasts
    const broadcast = currentSessionBroadcastId
      ? activeItems.find((b) => b.id === currentSessionBroadcastId) ||
        activeItems[0]
      : activeItems[0]

    if (!broadcast) {
      const upcomingResponse = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        broadcastStatus: 'upcoming',
      })

      const upcomingItems = upcomingResponse.data.items || []
      const upcomingBroadcast = currentSessionBroadcastId
        ? upcomingItems.find((b) => b.id === currentSessionBroadcastId) ||
          upcomingItems[0]
        : upcomingItems[0]

      if (!upcomingBroadcast) {
        // If we have a session broadcast, query it directly by ID
        // (it might be in 'created' state, not yet 'upcoming')
        if (currentSessionBroadcastId) {
          try {
            const directResponse = await youtube.liveBroadcasts.list({
              part: ['snippet', 'status'],
              id: [currentSessionBroadcastId],
            })
            const directBroadcast = directResponse.data.items?.[0]
            if (directBroadcast) {
              const result: BroadcastInfo = {
                broadcastId: directBroadcast.id!,
                title: directBroadcast.snippet?.title || '',
                url: `https://youtu.be/${directBroadcast.id}`,
                status:
                  directBroadcast.status?.lifeCycleStatus === 'live'
                    ? 'live'
                    : 'scheduled',
                scheduledStartTime: new Date(
                  directBroadcast.snippet?.scheduledStartTime || Date.now(),
                ),
                actualStartTime: directBroadcast.snippet?.actualStartTime
                  ? new Date(directBroadcast.snippet.actualStartTime)
                  : undefined,
              }
              activeBroadcastCache = { data: result, timestamp: Date.now() }
              return result
            }
          } catch {
            // Fall through
          }
        }
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

// Prime the cache with a known broadcast (e.g. after creation)
export function setActiveBroadcastCache(broadcast: BroadcastInfo): void {
  activeBroadcastCache = { data: broadcast, timestamp: Date.now() }
  currentSessionBroadcastId = broadcast.broadcastId
}

// Clear the cache and session broadcast ID (call on stream stop)
export function clearActiveBroadcastCache(): void {
  activeBroadcastCache = null
  currentSessionBroadcastId = null
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
      part: ['id', 'snippet', 'status', 'contentDetails'],
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
      boundStreamId: broadcast.contentDetails?.boundStreamId,
    }))
  }

  // Fallback to direct API fetch when OAuth credentials not configured
  const response = await youtubeApiFetch<YouTubeBroadcastListResponse>(
    'liveBroadcasts',
    {
      part: 'id,snippet,status,contentDetails',
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
    boundStreamId: broadcast.contentDetails?.boundStreamId,
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
