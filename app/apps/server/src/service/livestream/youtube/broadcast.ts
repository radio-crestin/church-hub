import { eq } from 'drizzle-orm'

import { getYouTubeService } from './client'
import { getYouTubeConfig } from './config'
import { getDatabase } from '../../../db'
import { broadcastHistory } from '../../../db/schema'
import type { BroadcastInfo } from '../types'

export async function createBroadcast(): Promise<BroadcastInfo> {
  const youtube = await getYouTubeService()

  if (!youtube) {
    throw new Error('Not authenticated with YouTube')
  }

  const config = await getYouTubeConfig()
  const now = new Date()

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

  const broadcast = broadcastResponse.data
  const broadcastId = broadcast.id!

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

export async function getActiveBroadcast(): Promise<BroadcastInfo | null> {
  const youtube = await getYouTubeService()

  if (!youtube) {
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
        return null
      }

      return {
        broadcastId: upcomingBroadcast.id!,
        title: upcomingBroadcast.snippet?.title || '',
        url: `https://youtu.be/${upcomingBroadcast.id}`,
        status: 'scheduled',
        scheduledStartTime: new Date(
          upcomingBroadcast.snippet?.scheduledStartTime || Date.now(),
        ),
      }
    }

    return {
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
  } catch {
    return null
  }
}

export async function endBroadcast(broadcastId: string): Promise<void> {
  const youtube = await getYouTubeService()

  if (!youtube) {
    throw new Error('Not authenticated with YouTube')
  }

  try {
    await youtube.liveBroadcasts.transition({
      id: broadcastId,
      broadcastStatus: 'complete',
      part: ['id', 'status'],
    })
  } catch {
    // Failed to transition, continue with updating local status
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

  if (!youtube) {
    throw new Error('Not authenticated with YouTube')
  }

  const response = await youtube.liveBroadcasts.list({
    part: ['id'],
    broadcastStatus: 'upcoming',
  })

  const broadcasts = response.data.items || []

  const db = getDatabase()
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
}

export async function getStreamKeys(): Promise<{ id: string; name: string }[]> {
  const youtube = await getYouTubeService()

  if (!youtube) {
    throw new Error('Not authenticated with YouTube')
  }

  const response = await youtube.liveStreams.list({
    part: ['id', 'snippet'],
    mine: true,
  })

  return (response.data.items || []).map((stream) => ({
    id: stream.id!,
    name: stream.snippet?.title || stream.id!,
  }))
}
