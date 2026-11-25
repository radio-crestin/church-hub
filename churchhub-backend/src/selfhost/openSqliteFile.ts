import type { SqliteFile } from './sqliteAsD1'

interface BunStatement {
  all(...params: unknown[]): Record<string, unknown>[]
  values(...params: unknown[]): unknown[][]
  run(...params: unknown[]): { changes: number }
}

interface NodeStatement {
  all(...params: unknown[]): Record<string, unknown>[]
  run(...params: unknown[]): { changes: number | bigint }
  setReturnArrays(enabled: boolean): void
}

// Module names in variables: TypeScript leaves them alone (the Worker build
// never loads this file), and each runtime loads only its own driver.
const BUN_SQLITE = 'bun:sqlite'
const NODE_SQLITE = 'node:sqlite'

/** Opens (or creates) the self-hosted central state on Bun or Node. */
export async function openSqliteFile(path: string): Promise<SqliteFile> {
  if ('Bun' in globalThis) {
    const { Database } = await import(BUN_SQLITE)
    const db = new Database(path, { create: true })
    const query = (sql: string) => db.query(sql) as BunStatement
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    return {
      all: (sql, params) => query(sql).all(...params),
      values: (sql, params) => query(sql).values(...params),
      run: (sql, params) => query(sql).run(...params).changes,
      exec: (sql) => db.exec(sql),
    }
  }

  const { DatabaseSync } = await import(NODE_SQLITE)
  const db = new DatabaseSync(path)
  const prepare = (sql: string) => db.prepare(sql) as NodeStatement
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  return {
    all: (sql, params) => prepare(sql).all(...params),
    values: (sql, params) => {
      const statement = prepare(sql)
      statement.setReturnArrays(true)
      return statement.all(...params) as unknown as unknown[][]
    },
    run: (sql, params) => Number(prepare(sql).run(...params).changes),
    exec: (sql) => db.exec(sql),
  }
}
