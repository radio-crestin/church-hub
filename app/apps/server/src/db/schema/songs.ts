import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const songCategories = sqliteTable(
  'song_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Global identity for Drive library sync; backfilled + auto-assigned by
    // the add-sync migration triggers, so inserts may omit it.
    uuid: text('uuid').notNull().default(''),
    name: text('name').notNull().unique(),
    priority: integer('priority').notNull().default(1),
    // 1 = hidden: the category and its songs are dropped from the song browser
    // (filters + list + search) but kept in the DB so it can be re-shown.
    isHidden: integer('is_hidden').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_song_categories_name').on(table.name)],
)

/**
 * Groups songs that are different versions of the same underlying piece
 * (different translations, lyric edits, denominational variants, etc.).
 * Membership is non-destructive: each member keeps its own row in `songs`;
 * the group merely records the relationship and which member is canonical.
 */
export const songGroups = sqliteTable(
  'song_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Global identity for Drive library sync (see add-sync migration).
    uuid: text('uuid').notNull().default(''),
    canonicalTitle: text('canonical_title').notNull(),
    // `primarySongId` is set by application logic. We deliberately do NOT
    // declare it as a FK here because `songs` references `songGroups` too
    // and Drizzle's lazy resolver would create a circular dependency in
    // generated migrations. The service layer enforces validity.
    primarySongId: integer('primary_song_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_song_groups_primary').on(table.primarySongId)],
)

export const songs = sqliteTable(
  'songs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Global identity for Drive library sync (see add-sync migration).
    uuid: text('uuid').notNull().default(''),
    title: text('title').notNull(),
    categoryId: integer('category_id').references(() => songCategories.id, {
      onDelete: 'set null',
    }),
    // Nullable: a song without a group is its own canonical version. Deleting
    // the group only detaches members — they keep their lyrics, etc.
    songGroupId: integer('song_group_id').references(() => songGroups.id, {
      onDelete: 'set null',
    }),
    sourceFilename: text('source_filename'),
    author: text('author'),
    copyright: text('copyright'),
    ccli: text('ccli'),
    tempo: text('tempo'),
    timeSignature: text('time_signature'),
    theme: text('theme'),
    altTheme: text('alt_theme'),
    hymnNumber: text('hymn_number'),
    keyLine: text('key_line'),
    presentationOrder: text('presentation_order'),
    presentationCount: integer('presentation_count').notNull().default(0),
    lastPresentedAt: integer('last_presented_at', { mode: 'timestamp' }),
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
    index('idx_songs_song_group_id').on(table.songGroupId),
    // Backs the exact-filename dedup pass in the song-discovery flow
    // (matchCandidatesAgainstLibrary), which probes source_filename per
    // external candidate before falling back to title/fuzzy matching.
    index('idx_songs_source_filename').on(table.sourceFilename),
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
    chords: text('chords'), // JSON array: [{wordIndex: number, chord: string}]
    label: text('label'),
    // Free-text speaker note for this slide (PowerPoint-style "what happens on
    // this slide"). Shown/edited in the notes panel below the stage canvas.
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // Compound index optimizes queries filtering by song_id and ordering by sort_order
    // Also covers song_id-only lookups since it's the index prefix
    index('idx_song_slides_song_id_sort_order').on(
      table.songId,
      table.sortOrder,
    ),
  ],
)

export const songBookmarks = sqliteTable(
  'song_bookmarks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    // Manual "already sung" marker for the bookmarks list in the song stage
    // view. Operators toggle it during a service to track what's been sung.
    isSung: integer('is_sung', { mode: 'boolean' }).notNull().default(false),
    sungAt: integer('sung_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // Deliberately not unique: the same song may be bookmarked several times
    // (see the allow-duplicate-bookmarks migration).
    index('idx_song_bookmarks_song_id').on(table.songId),
    index('idx_song_bookmarks_sort_order').on(table.sortOrder),
    index('idx_song_bookmarks_created_at').on(table.createdAt),
  ],
)

export const songTags = sqliteTable(
  'song_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_song_tags_sort_order').on(table.sortOrder)],
)

export const songTagAssignments = sqliteTable(
  'song_tag_assignments',
  {
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => songTags.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    primaryKey({ columns: [table.songId, table.tagId] }),
    index('idx_song_tag_assignments_tag_id').on(table.tagId),
  ],
)

export const songBookmarkNotes = sqliteTable(
  'song_bookmark_notes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    content: text('content').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_song_bookmark_notes_sort_order').on(table.sortOrder)],
)
