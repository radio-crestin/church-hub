import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { bibleVerses } from './bible'
import { songs } from './songs'

export const schedules = sqliteTable(
  'schedules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Global identity for Drive library sync (see add-sync migration).
    uuid: text('uuid').notNull().default(''),
    title: text('title').notNull(),
    description: text('description'),
    // Automation (see add-schedule-automation migration). Local to this
    // computer: not part of the Drive library sync.
    autoplaySeconds: integer('autoplay_seconds'),
    autoplayByText: integer('autoplay_by_text', { mode: 'boolean' })
      .notNull()
      .default(true),
    loop: integer('loop', { mode: 'boolean' }).notNull().default(false),
    musicVolume: integer('music_volume'),
    startOnAppStart: integer('start_on_app_start', { mode: 'boolean' })
      .notNull()
      .default(false),
    // The slide template for all its slides (slide_templates.id); NULL = each
    // screen's own. Local to this computer, like the automation.
    templateId: integer('template_id'),
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
    // Seconds each slide of this item stays up while the presentation runs by
    // itself; NULL = the presentation's timing.
    advanceSeconds: integer('advance_seconds'),
    // This item's own slide template; NULL = the presentation's.
    templateId: integer('template_id'),
    // Manual "already sung" marker, per schedule (mirrors song_bookmarks).
    // Only meaningful for itemType === 'song'.
    isSung: integer('is_sung', { mode: 'boolean' }).notNull().default(false),
    sungAt: integer('sung_at', { mode: 'timestamp' }),
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
    index('idx_schedule_bible_passage_verses_verse_id').on(table.verseId),
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
    // Optional: a passage added straight from the Bible carries no person.
    // Kept NOT NULL with a '' default so every read site sees a plain string.
    personName: text('person_name').notNull().default(''),
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
