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
  stopSceneName: text('stop_scene_name'),
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
    contentTypes: text('content_types').notNull().default('[]'),
    mixerChannelActions: text('mixer_channel_actions')
      .notNull()
      .default('{"mute":[],"unmute":[]}'),
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

export const sceneAutomationState = sqliteTable('scene_automation_state', {
  id: integer('id').primaryKey(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  previousSceneName: text('previous_scene_name'),
  currentAutoScene: text('current_auto_scene'),
  lastContentType: text('last_content_type'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

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

export const mixerConfig = sqliteTable('mixer_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  host: text('host').notNull().default('192.168.0.50'),
  port: integer('port').notNull().default(10024),
  isEnabled: integer('is_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  channelCount: integer('channel_count').notNull().default(16),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const mixerChannels = sqliteTable(
  'mixer_channels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channelNumber: integer('channel_number').notNull().unique(),
    label: text('label').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_mixer_channels_number').on(table.channelNumber)],
)
