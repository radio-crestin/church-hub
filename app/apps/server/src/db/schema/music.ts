import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const musicFolders = sqliteTable(
  'music_folders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    path: text('path').notNull().unique(),
    name: text('name').notNull(),
    isRecursive: integer('is_recursive', { mode: 'boolean' })
      .notNull()
      .default(true),
    lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
    fileCount: integer('file_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_music_folders_path').on(table.path)],
)

export const musicFiles = sqliteTable(
  'music_files',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    folderId: integer('folder_id')
      .notNull()
      .references(() => musicFolders.id, { onDelete: 'cascade' }),
    path: text('path').notNull().unique(),
    filename: text('filename').notNull(),
    title: text('title'),
    artist: text('artist'),
    album: text('album'),
    genre: text('genre'),
    year: integer('year'),
    trackNumber: integer('track_number'),
    duration: real('duration'),
    format: text('format', {
      enum: ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
    }).notNull(),
    fileSize: integer('file_size'),
    lastModified: integer('last_modified', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_music_files_folder_id').on(table.folderId),
    index('idx_music_files_path').on(table.path),
    index('idx_music_files_title').on(table.title),
    index('idx_music_files_artist').on(table.artist),
    index('idx_music_files_album').on(table.album),
  ],
)

export const musicPlaylists = sqliteTable(
  'music_playlists',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    itemCount: integer('item_count').notNull().default(0),
    totalDuration: real('total_duration').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_music_playlists_name').on(table.name)],
)

export const musicPlaylistItems = sqliteTable(
  'music_playlist_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playlistId: integer('playlist_id')
      .notNull()
      .references(() => musicPlaylists.id, { onDelete: 'cascade' }),
    fileId: integer('file_id')
      .notNull()
      .references(() => musicFiles.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_music_playlist_items_playlist_sort').on(
      table.playlistId,
      table.sortOrder,
    ),
    index('idx_music_playlist_items_file_id').on(table.fileId),
  ],
)

export const musicNowPlaying = sqliteTable(
  'music_now_playing',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileId: integer('file_id')
      .notNull()
      .references(() => musicFiles.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_music_now_playing_sort_order').on(table.sortOrder),
    index('idx_music_now_playing_file_id').on(table.fileId),
  ],
)
