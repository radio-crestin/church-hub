import type { BatchItem } from 'drizzle-orm/batch'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type * as postgresSchema from './postgresSchema'
import type * as sqliteSchema from './sqliteSchema'

/**
 * The central state's tables, typed as SQLite's: every dialect's schema has
 * the same tables, columns and row types (checked below).
 */
export type SyncTables = typeof sqliteSchema

/**
 * The dialect's drizzle database, typed as SQLite's. The sync code uses only
 * what every dialect's query builder shares: select, insert (with
 * `onConflictDoUpdate` or `… select`), update and delete, and `sql` that is
 * valid on both (standard `CAST`, `excluded.`).
 */
export type SyncQuery = BaseSQLiteDatabase<'async', unknown>

export type SyncStatement = BatchItem<'sqlite'>

/**
 * Where the sync service keeps its central state: any database drizzle
 * drives in the SQLite family (D1, libsql: a file, Turso, sqld) or the
 * PostgreSQL family (any Postgres server, Neon, Supabase, Hyperdrive).
 */
export interface SyncDb {
  dialect: 'sqlite' | 'postgresql'
  q: SyncQuery
  t: SyncTables
  /**
   * Runs the statements `build` makes on the query builder it is given, in
   * order, all or none: one batch on D1 and libsql, one transaction on
   * Postgres.
   */
  atomic(build: (q: SyncQuery) => SyncStatement[]): Promise<void>
  close(): Promise<void>
}

/** Fails to compile when a Postgres table's rows differ from SQLite's. */
type SameRows<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
export const SAME_ROWS_IN_EVERY_DIALECT: {
  [K in keyof SyncTables]: SameRows<
    SyncTables[K]['$inferSelect'],
    (typeof postgresSchema)[K]['$inferSelect']
  >
} = {
  churches: true,
  devices: true,
  roles: true,
  rolePermissions: true,
  users: true,
  userPermissions: true,
  entities: true,
  bucketObjects: true,
}
