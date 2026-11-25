import { defineConfig } from 'drizzle-kit'

/**
 * Cloud sync on PostgreSQL. `npm run db:generate` writes the migrations;
 * `npm run db:migrate:postgresql` applies them to SYNC_DATABASE_URL (the
 * self-hosted server applies them on start).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/sync/db/postgresSchema.ts',
  out: './migrations/postgresql',
  dbCredentials: { url: process.env.SYNC_DATABASE_URL ?? '' },
})
