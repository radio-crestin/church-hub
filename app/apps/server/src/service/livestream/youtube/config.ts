import { eq } from 'drizzle-orm'

import { getDatabase } from '../../../db'
import { youtubeConfig } from '../../../db/schema'
import type { YouTubeConfig } from '../types'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [youtube-config] ${message}`)
}

export async function getYouTubeConfig(): Promise<YouTubeConfig> {
  const db = getDatabase()
  const configs = await db.select().from(youtubeConfig).limit(1)

  if (configs.length === 0) {
    const [newConfig] = await db
      .insert(youtubeConfig)
      .values({
        titleTemplate: 'Live',
        description: '',
        privacyStatus: 'unlisted',
        broadcastMode: 'create',
      })
      .returning()

    return {
      id: newConfig.id,
      titleTemplate: newConfig.titleTemplate,
      description: newConfig.description,
      privacyStatus: newConfig.privacyStatus as
        | 'public'
        | 'unlisted'
        | 'private',
      streamKeyId: newConfig.streamKeyId || undefined,
      playlistId: newConfig.playlistId || undefined,
      startSceneName: newConfig.startSceneName || undefined,
      stopSceneName: newConfig.stopSceneName || undefined,
      selectedBroadcastId: newConfig.selectedBroadcastId || undefined,
      broadcastMode: (newConfig.broadcastMode || 'create') as
        | 'create'
        | 'reuse',
    }
  }

  const config = configs[0]
  return {
    id: config.id,
    titleTemplate: config.titleTemplate,
    description: config.description,
    privacyStatus: config.privacyStatus as 'public' | 'unlisted' | 'private',
    streamKeyId: config.streamKeyId || undefined,
    playlistId: config.playlistId || undefined,
    startSceneName: config.startSceneName || undefined,
    stopSceneName: config.stopSceneName || undefined,
    selectedBroadcastId: config.selectedBroadcastId || undefined,
    broadcastMode: (config.broadcastMode || 'create') as 'create' | 'reuse',
  }
}

export async function updateYouTubeConfig(
  data: Partial<Omit<YouTubeConfig, 'id'>>,
): Promise<YouTubeConfig> {
  log('info', `Updating config: ${JSON.stringify(data)}`)
  if (data.streamKeyId !== undefined) {
    log('info', `Setting streamKeyId to: ${data.streamKeyId || 'null/empty'}`)
  }
  const db = getDatabase()
  const current = await getYouTubeConfig()

  const [updated] = await db
    .update(youtubeConfig)
    .set({
      ...(data.titleTemplate !== undefined && {
        titleTemplate: data.titleTemplate,
      }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.privacyStatus !== undefined && {
        privacyStatus: data.privacyStatus,
      }),
      ...(data.streamKeyId !== undefined && { streamKeyId: data.streamKeyId }),
      ...(data.playlistId !== undefined && { playlistId: data.playlistId }),
      ...(data.startSceneName !== undefined && {
        startSceneName: data.startSceneName,
      }),
      ...(data.stopSceneName !== undefined && {
        stopSceneName: data.stopSceneName,
      }),
      ...(data.selectedBroadcastId !== undefined && {
        selectedBroadcastId: data.selectedBroadcastId,
      }),
      ...(data.broadcastMode !== undefined && {
        broadcastMode: data.broadcastMode,
      }),
      updatedAt: new Date(),
    })
    .where(eq(youtubeConfig.id, current.id!))
    .returning()

  log('info', `Config updated. streamKeyId is now: ${updated.streamKeyId || 'NOT SET'}`)

  return {
    id: updated.id,
    titleTemplate: updated.titleTemplate,
    description: updated.description,
    privacyStatus: updated.privacyStatus as 'public' | 'unlisted' | 'private',
    streamKeyId: updated.streamKeyId || undefined,
    playlistId: updated.playlistId || undefined,
    startSceneName: updated.startSceneName || undefined,
    stopSceneName: updated.stopSceneName || undefined,
    selectedBroadcastId: updated.selectedBroadcastId || undefined,
    broadcastMode: (updated.broadcastMode || 'create') as 'create' | 'reuse',
  }
}
