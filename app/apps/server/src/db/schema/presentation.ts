import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { songSlides } from './songs'

// Screen types enum
export const screenTypes = ['primary', 'stage', 'livestream', 'kiosk'] as const

// Content types that can be rendered on screens
export const contentTypes = [
  'song',
  'song_first_slide',
  'song_last_slide',
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
      .default(true),
    /**
     * Name of the physical monitor this screen projects onto, as the OS reports
     * it. Null means "wherever the window opens". Written both by the operator's
     * choice in the screens settings and by the window when it is dragged to
     * another monitor, so a closed projection comes back where it was.
     */
    monitorName: text('monitor_name'),
    // On by default since T-026: createScreen and the seed write true, and
    // enable-screens-always-on-top switched existing screens on once. The
    // column default stays 0 (changing it means rebuilding the table).
    alwaysOnTop: integer('always_on_top', { mode: 'boolean' })
      .notNull()
      .default(false),
    closeOnEscape: integer('close_on_escape', { mode: 'boolean' })
      .notNull()
      .default(false),
    // When true, this screen is mirrored in the in-app control-room preview.
    // At most one screen is the preview screen at a time (enforced in service).
    isPreviewScreen: integer('is_preview_screen', { mode: 'boolean' })
      .notNull()
      .default(false),
    /**
     * Open this screen's window automatically when the app launches. Separate
     * from `isActive`, which only says the screen has a window: a screen with
     * this off stays closed at launch but still opens as soon as something is
     * presented to it.
     */
    openOnStartup: integer('open_on_startup', { mode: 'boolean' })
      .notNull()
      .default(true),
    /**
     * The slide template this screen draws with (slide_templates.id); its
     * design canvas, layouts, clock and next-slide strip. Set for every screen
     * (move-screen-layouts-into-templates, seed-screens, createScreen).
     */
    templateId: integer('template_id'),
    /**
     * Draw a running presentation (and its items) with the presentation's
     * template instead of this screen's own. On for the projector and kiosk.
     */
    followsPresentation: integer('follows_presentation', { mode: 'boolean' })
      .notNull()
      .default(false),
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
