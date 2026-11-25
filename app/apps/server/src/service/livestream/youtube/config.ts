import { eq, getTableColumns } from 'drizzle-orm'

import { getDatabase } from '../../../db'
import { youtubeConfig } from '../../../db/schema'
import type { YouTubeConfig } from '../types'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [youtube-config] ${message}`)
}

type ConfigRow = typeof youtubeConfig.$inferSelect

/** The settings a client may change: every column but the row's own. */
const SETTABLE = new Set(
  Object.keys(getTableColumns(youtubeConfig)).filter(
    (key) => !['id', 'createdAt', 'updatedAt'].includes(key),
  ),
)

/** A changed setting; `null` clears an optional one. */
export type YouTubeConfigUpdate = {
  [K in keyof Omit<YouTubeConfig, 'id'>]?: YouTubeConfig[K] | null
}

function parseTags(tags: string): string[] {
  const parsed: unknown = JSON.parse(tags)
  return Array.isArray(parsed) ? parsed.map(String) : []
}

function toConfig(row: ConfigRow): YouTubeConfig {
  return {
    id: row.id,
    titleTemplate: row.titleTemplate,
    description: row.description,
    privacyStatus: row.privacyStatus as YouTubeConfig['privacyStatus'],
    streamKeyId: row.streamKeyId || undefined,
    playlistId: row.playlistId || undefined,
    startSceneName: row.startSceneName || undefined,
    stopSceneName: row.stopSceneName || undefined,
    selectedBroadcastId: row.selectedBroadcastId || undefined,
    broadcastMode: (row.broadcastMode || 'create') as 'create' | 'reuse',
    categoryId: row.categoryId || undefined,
    tags: parseTags(row.tags),
    madeForKids: row.madeForKids,
    latencyPreference:
      row.latencyPreference as YouTubeConfig['latencyPreference'],
    enableDvr: row.enableDvr,
    enableAutoStart: row.enableAutoStart,
    enableAutoStop: row.enableAutoStop,
    thumbnailUrl: row.thumbnailUrl || undefined,
    descriptionChapters: row.descriptionChapters,
  }
}

export async function getYouTubeConfig(): Promise<YouTubeConfig> {
  const db = getDatabase()
  const [config] = await db.select().from(youtubeConfig).limit(1)
  if (config) return toConfig(config)

  const [created] = await db
    .insert(youtubeConfig)
    .values({
      titleTemplate: 'Live',
      description: '',
      privacyStatus: 'unlisted',
      broadcastMode: 'create',
    })
    .returning()
  if (!created) throw new Error('Inserting the YouTube config failed')
  return toConfig(created)
}

export async function updateYouTubeConfig(
  data: YouTubeConfigUpdate,
): Promise<YouTubeConfig> {
  log('info', `Updating config: ${JSON.stringify(data)}`)
  const db = getDatabase()
  const current = await getYouTubeConfig()

  const changes = Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) => SETTABLE.has(key) && value !== undefined,
    ),
  ) as Partial<ConfigRow>
  if (data.tags !== undefined) {
    changes.tags = JSON.stringify(data.tags ?? [])
  }

  const [updated] = await db
    .update(youtubeConfig)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(youtubeConfig.id, current.id!))
    .returning()
  if (!updated) throw new Error('Updating the YouTube config failed')

  return toConfig(updated)
}
