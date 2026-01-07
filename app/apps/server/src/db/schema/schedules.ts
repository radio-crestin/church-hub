import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { bibleVerses } from './bible'
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
    itemType: text('item_type', {
      enum: ['song', 'slide', 'bible_passage'],
    }).notNull(),
    songId: integer('song_id').references(() => songs.id, {
      onDelete: 'cascade',
    }),
    slideType: text('slide_type', {
      enum: ['announcement', 'versete_tineri', 'scene'],
    }),
    slideContent: text('slide_content'),
    // Bible passage fields (when itemType === 'bible_passage')
    biblePassageReference: text('bible_passage_reference'),
    biblePassageTranslation: text('bible_passage_translation'),
    // Scene fields (when slideType === 'scene')
    obsSceneName: text('obs_scene_name'),
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

// Bible passage verses for schedule items (nested within bible_passage schedule items)
export const scheduleBiblePassageVerses = sqliteTable(
  'schedule_bible_passage_verses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    scheduleItemId: integer('schedule_item_id')
      .notNull()
      .references(() => scheduleItems.id, { onDelete: 'cascade' }),
    verseId: integer('verse_id')
      .notNull()
      .references(() => bibleVerses.id, { onDelete: 'cascade' }),
    reference: text('reference').notNull(),
    text: text('text').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_schedule_bible_passage_verses_item_id').on(table.scheduleItemId),
    index('idx_schedule_bible_passage_verses_sort_order').on(table.sortOrder),
  ],
)

// Versete Tineri entries for schedule items (nested within versete_tineri slides)
export const scheduleVerseteTineriEntries = sqliteTable(
  'schedule_versete_tineri_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    scheduleItemId: integer('schedule_item_id')
      .notNull()
      .references(() => scheduleItems.id, { onDelete: 'cascade' }),
    personName: text('person_name').notNull(),
    translationId: integer('translation_id').notNull(),
    bookCode: text('book_code').notNull(),
    bookName: text('book_name').notNull(),
    reference: text('reference').notNull(),
    text: text('text').notNull(),
    startChapter: integer('start_chapter').notNull(),
    startVerse: integer('start_verse').notNull(),
    endChapter: integer('end_chapter').notNull(),
    endVerse: integer('end_verse').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_schedule_versete_tineri_entries_item_id').on(
      table.scheduleItemId,
    ),
    index('idx_schedule_versete_tineri_entries_sort_order').on(table.sortOrder),
  ],
)
