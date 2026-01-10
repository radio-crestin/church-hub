import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { songSlides } from './songs'

// Screen types enum
export const screenTypes = ['primary', 'stage', 'livestream', 'kiosk'] as const

// Content types that can be rendered on screens
export const contentTypes = [
  'song',
  'bible',
  'bible_passage',
  'announcement',
  'versete_tineri',
  'empty',
  'screen_share',
] as const

// New screens table - replaces displays with enhanced functionality
export const screens = sqliteTable(
  'screens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: screenTypes }).notNull().default('primary'),
    isActive: integer('is_active', { mode: 'boolean' })
      .notNull()
      .default(false),
    openMode: text('open_mode').notNull().default('browser'),
    isFullscreen: integer('is_fullscreen', { mode: 'boolean' })
      .notNull()
      .default(false),
    alwaysOnTop: integer('always_on_top', { mode: 'boolean' })
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

export const presentationState = sqliteTable('presentation_state', {
  id: integer('id').primaryKey(),
  isPresenting: integer('is_presenting', { mode: 'boolean' })
    .notNull()
    .default(false),
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
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
  // Temporary content for instant display
  // JSON: { type: 'bible' | 'song' | 'announcement' | 'bible_passage' | 'versete_tineri', data: ... }
  temporaryContent: text('temporary_content'),
  // Slide highlights for live text styling
  // JSON: Array<{ id: string, start: number, end: number, highlight?: string, bold?: boolean, underline?: boolean }>
  slideHighlights: text('slide_highlights'),
  // Store as milliseconds (not seconds) for precise ordering of rapid updates
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
})

// Bible verse history - tracks all displayed verses, cleared on graceful app exit
export const bibleHistory = sqliteTable(
  'bible_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    verseId: integer('verse_id').notNull(),
    reference: text('reference').notNull(),
    text: text('text').notNull(),
    translationAbbreviation: text('translation_abbreviation').notNull(),
    bookName: text('book_name').notNull(),
    translationId: integer('translation_id').notNull(),
    bookId: integer('book_id').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_bible_history_created_at').on(table.createdAt)],
)
