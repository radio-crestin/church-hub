import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { bibleVerses } from './bible'
import { songSlides, songs } from './songs'

// Screen types enum
export const screenTypes = ['primary', 'stage', 'livestream'] as const

// Content types that can be rendered on screens
export const contentTypes = [
  'song',
  'bible',
  'bible_passage',
  'announcement',
  'versete_tineri',
  'empty',
] as const

// New screens table - replaces displays with enhanced functionality
export const screens = sqliteTable(
  'screens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: screenTypes }).notNull().default('primary'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    openMode: text('open_mode').notNull().default('browser'),
    isFullscreen: integer('is_fullscreen', { mode: 'boolean' })
      .notNull()
      .default(false),
    width: integer('width').notNull().default(1920),
    height: integer('height').notNull().default(1080),
    globalSettings: text('global_settings').notNull().default('{}'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_screens_is_active').on(table.isActive),
    index('idx_screens_type').on(table.type),
    index('idx_screens_sort_order').on(table.sortOrder),
  ],
)

// Per-content-type configuration for each screen
export const screenContentConfigs = sqliteTable(
  'screen_content_configs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    screenId: integer('screen_id')
      .notNull()
      .references(() => screens.id, { onDelete: 'cascade' }),
    contentType: text('content_type', { enum: contentTypes }).notNull(),
    config: text('config').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_screen_content_configs_screen_id').on(table.screenId),
    index('idx_screen_content_configs_content_type').on(table.contentType),
  ],
)

// Next slide section configuration (for stage screens)
export const screenNextSlideConfigs = sqliteTable(
  'screen_next_slide_configs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    screenId: integer('screen_id')
      .notNull()
      .references(() => screens.id, { onDelete: 'cascade' }),
    config: text('config').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_screen_next_slide_configs_screen_id').on(table.screenId),
  ],
)

export const presentationQueue = sqliteTable(
  'presentation_queue',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    itemType: text('item_type', {
      enum: ['song', 'slide', 'bible', 'bible_passage'],
    }).notNull(),
    songId: integer('song_id').references(() => songs.id, {
      onDelete: 'cascade',
    }),
    slideType: text('slide_type', { enum: ['announcement', 'versete_tineri'] }),
    slideContent: text('slide_content'),
    bibleVerseId: integer('bible_verse_id').references(() => bibleVerses.id, {
      onDelete: 'cascade',
    }),
    bibleReference: text('bible_reference'),
    bibleText: text('bible_text'),
    bibleTranslation: text('bible_translation'),
    // Bible passage fields (when itemType === 'bible_passage')
    biblePassageReference: text('bible_passage_reference'),
    biblePassageTranslation: text('bible_passage_translation'),
    sortOrder: integer('sort_order').notNull().default(0),
    isExpanded: integer('is_expanded', { mode: 'boolean' })
      .notNull()
      .default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_presentation_queue_sort_order').on(table.sortOrder),
    index('idx_presentation_queue_song_id').on(table.songId),
    index('idx_presentation_queue_bible_verse_id').on(table.bibleVerseId),
  ],
)

export const biblePassageVerses = sqliteTable(
  'bible_passage_verses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    queueItemId: integer('queue_item_id').references(
      () => presentationQueue.id,
      {
        onDelete: 'cascade',
      },
    ),
    verseId: integer('verse_id')
      .notNull()
      .references(() => bibleVerses.id, {
        onDelete: 'cascade',
      }),
    reference: text('reference').notNull(),
    text: text('text').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_bible_passage_verses_queue_item_id').on(table.queueItemId),
    index('idx_bible_passage_verses_sort_order').on(table.sortOrder),
  ],
)

export const verseteTineriEntries = sqliteTable(
  'versete_tineri_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    queueItemId: integer('queue_item_id')
      .notNull()
      .references(() => presentationQueue.id, {
        onDelete: 'cascade',
      }),
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
    index('idx_versete_tineri_entries_queue_item_id').on(table.queueItemId),
    index('idx_versete_tineri_entries_sort_order').on(table.sortOrder),
  ],
)

export const presentationState = sqliteTable('presentation_state', {
  id: integer('id').primaryKey(),
  isPresenting: integer('is_presenting', { mode: 'boolean' })
    .notNull()
    .default(false),
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  currentQueueItemId: integer('current_queue_item_id').references(
    () => presentationQueue.id,
    { onDelete: 'set null' },
  ),
  currentSongSlideId: integer('current_song_slide_id').references(
    () => songSlides.id,
    {
      onDelete: 'set null',
    },
  ),
  lastSongSlideId: integer('last_song_slide_id').references(
    () => songSlides.id,
    {
      onDelete: 'set null',
    },
  ),
  currentBiblePassageVerseId: integer(
    'current_bible_passage_verse_id',
  ).references(() => biblePassageVerses.id, {
    onDelete: 'set null',
  }),
  currentVerseteTineriEntryId: integer(
    'current_versete_tineri_entry_id',
  ).references(() => verseteTineriEntries.id, {
    onDelete: 'set null',
  }),
  // Temporary content for instant display (bypasses queue)
  // JSON: { type: 'bible' | 'song', data: TemporaryBibleContent | TemporarySongContent }
  temporaryContent: text('temporary_content'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})
