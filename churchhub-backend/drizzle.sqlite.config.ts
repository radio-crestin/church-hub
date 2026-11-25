import { defineConfig } from 'drizzle-kit'

/**
 * Cloud sync on SQLite (D1, libsql). `npm run db:generate` writes the
 * migrations wrangler applies to D1 and the self-hosted server applies on
 * start.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/sync/db/sqliteSchema.ts',
  out: './migrations/sqlite',
})
