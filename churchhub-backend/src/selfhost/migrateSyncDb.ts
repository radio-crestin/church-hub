import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate as migrateLibsql } from 'drizzle-orm/libsql/migrator'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import type { SyncDb } from '../sync/db/SyncDb'

const NODE_URL = 'node:url'

/**
 * Applies the dialect's drizzle-kit migrations (migrations/sqlite or
 * migrations/postgresql), each once, tracked in `__drizzle_migrations`.
 */
export async function migrateSyncDb(db: SyncDb): Promise<void> {
  const { fileURLToPath } = (await import(NODE_URL)) as {
    fileURLToPath(url: URL): string
  }
  const here = (import.meta as unknown as { url: string }).url
  const migrationsFolder = fileURLToPath(
    new URL(`../../migrations/${db.dialect}`, here)
  )
  if (db.dialect === 'postgresql') {
    await migratePostgres(db.q as unknown as PostgresJsDatabase, {
      migrationsFolder,
    })
  } else {
    await migrateLibsql(db.q as unknown as LibSQLDatabase, { migrationsFolder })
  }
}
