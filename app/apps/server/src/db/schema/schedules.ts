import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { songs } from './songs'

export const schedules = sqliteTable(
  'schedules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_schedules_title').on(table.title)],
)

export const scheduleItems = sqliteTable(
  'schedule_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    scheduleId: integer('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    itemType: text('item_type', { enum: ['song', 'slide'] }).notNull(),
    songId: integer('song_id').references(() => songs.id, {
      onDelete: 'cascade',
    }),
    slideType: text('slide_type', { enum: ['announcement', 'versete_tineri'] }),
    slideContent: text('slide_content'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_schedule_items_schedule_id').on(table.scheduleId),
    index('idx_schedule_items_sort_order').on(table.sortOrder),
    index('idx_schedule_items_song_id').on(table.songId),
  ],
)
