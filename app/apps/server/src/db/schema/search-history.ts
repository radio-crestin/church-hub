import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Search types for song searches
export const searchTypes = ['regular', 'ai'] as const

export const songSearchHistory = sqliteTable(
  'song_search_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    query: text('query').notNull(),
    urlPath: text('url_path').notNull(),
    searchType: text('search_type', { enum: searchTypes })
      .notNull()
      .default('regular'),
    categoryIds: text('category_ids'), // JSON array: [1, 2, 3] or null
    // AI search results stored as JSON for restoration
    aiResults: text('ai_results'), // JSON array of AISearchResult or null
    resultCount: integer('result_count'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_song_search_history_created_at').on(table.createdAt),
    index('idx_song_search_history_search_type').on(table.searchType),
  ],
)
