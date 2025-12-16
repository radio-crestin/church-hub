import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'

export const bibleTranslations = sqliteTable(
  'bible_translations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    abbreviation: text('abbreviation').notNull().unique(),
    language: text('language').notNull(),
    sourceFilename: text('source_filename'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_bible_translations_abbreviation').on(table.abbreviation),
  ],
)

export const bibleBooks = sqliteTable(
  'bible_books',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    translationId: integer('translation_id')
      .notNull()
      .references(() => bibleTranslations.id, { onDelete: 'cascade' }),
    bookCode: text('book_code').notNull(),
    bookName: text('book_name').notNull(),
    bookOrder: integer('book_order').notNull(),
    chapterCount: integer('chapter_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_bible_books_translation_id').on(table.translationId),
    index('idx_bible_books_order').on(table.translationId, table.bookOrder),
    unique('bible_books_translation_book').on(
      table.translationId,
      table.bookCode,
    ),
  ],
)

export const bibleVerses = sqliteTable(
  'bible_verses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    translationId: integer('translation_id')
      .notNull()
      .references(() => bibleTranslations.id, { onDelete: 'cascade' }),
    bookId: integer('book_id')
      .notNull()
      .references(() => bibleBooks.id, { onDelete: 'cascade' }),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    text: text('text').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_bible_verses_lookup').on(
      table.bookId,
      table.chapter,
      table.verse,
    ),
    index('idx_bible_verses_translation').on(table.translationId),
    unique('bible_verses_unique').on(
      table.translationId,
      table.bookId,
      table.chapter,
      table.verse,
    ),
  ],
)
