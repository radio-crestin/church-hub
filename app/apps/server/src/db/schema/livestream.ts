import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const youtubeAuth = sqliteTable('youtube_auth', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  channelId: text('channel_id'),
  channelName: text('channel_name'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const youtubeConfig = sqliteTable('youtube_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  titleTemplate: text('title_template').notNull().default('Live'),
  description: text('description').notNull().default(''),
  privacyStatus: text('privacy_status').notNull().default('unlisted'),
  streamKeyId: text('stream_key_id'),
  playlistId: text('playlist_id'),
  startSceneName: text('start_scene_name'),
  selectedBroadcastId: text('selected_broadcast_id'),
  broadcastMode: text('broadcast_mode').notNull().default('create'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const obsConfig = sqliteTable('obs_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  host: text('host').notNull().default('127.0.0.1'),
  port: integer('port').notNull().default(4455),
  password: text('password').notNull().default(''),
  autoConnect: integer('auto_connect', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const obsScenes = sqliteTable(
  'obs_scenes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    obsSceneName: text('obs_scene_name').notNull().unique(),
    displayName: text('display_name').notNull(),
    isVisible: integer('is_visible', { mode: 'boolean' })
      .notNull()
      .default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    shortcuts: text('shortcuts').notNull().default('[]'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_obs_scenes_sort_order').on(table.sortOrder),
    index('idx_obs_scenes_is_visible').on(table.isVisible),
  ],
)

export const broadcastHistory = sqliteTable(
  'broadcast_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    broadcastId: text('broadcast_id').notNull(),
    title: text('title').notNull(),
    scheduledStartTime: integer('scheduled_start_time', {
      mode: 'timestamp',
    }).notNull(),
    actualStartTime: integer('actual_start_time', { mode: 'timestamp' }),
    endTime: integer('end_time', { mode: 'timestamp' }),
    url: text('url').notNull(),
    status: text('status').notNull().default('scheduled'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_broadcast_history_status').on(table.status)],
)

export const broadcastTemplates = sqliteTable(
  'broadcast_templates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    privacyStatus: text('privacy_status').notNull().default('unlisted'),
    streamKeyId: text('stream_key_id'),
    playlistId: text('playlist_id'),
    category: text('category'),
    usedAt: integer('used_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_broadcast_templates_used_at').on(table.usedAt)],
)
