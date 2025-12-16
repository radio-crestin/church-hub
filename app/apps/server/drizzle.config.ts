import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema/index.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/app.db',
  },
})
