import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Secrets only the server itself uses (the signaling host keys). No HTTP
 * route reads this table; it is reached through service/server-secrets.
 */
export const serverSecrets = sqliteTable('server_secrets', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})
