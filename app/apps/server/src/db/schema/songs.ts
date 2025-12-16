import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const songCategories = sqliteTable(
  'song_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    priority: integer('priority').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_song_categories_name').on(table.name)],
)

export const songs = sqliteTable(
  'songs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull().unique(),
    categoryId: integer('category_id').references(() => songCategories.id, {
      onDelete: 'set null',
    }),
    sourceFilename: text('source_filename'),
    author: text('author'),
    copyright: text('copyright'),
    ccli: text('ccli'),
    key: text('key'),
    tempo: text('tempo'),
    timeSignature: text('time_signature'),
    theme: text('theme'),
    altTheme: text('alt_theme'),
    hymnNumber: text('hymn_number'),
    keyLine: text('key_line'),
    presentationOrder: text('presentation_order'),
    presentationCount: integer('presentation_count').notNull().default(0),
    lastManualEdit: integer('last_manual_edit', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_songs_title').on(table.title),
    index('idx_songs_category_id').on(table.categoryId),
  ],
)

export const songSlides = sqliteTable(
  'song_slides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    label: text('label'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_song_slides_song_id').on(table.songId),
    index('idx_song_slides_sort_order').on(table.sortOrder),
  ],
)
