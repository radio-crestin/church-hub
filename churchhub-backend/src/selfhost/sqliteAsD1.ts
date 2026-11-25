/**
 * A synchronous SQLite file (bun:sqlite or node:sqlite) behind the subset of
 * Cloudflare's D1 interface drizzle's D1 driver uses, so the sync service runs
 * the same queries self-hosted as on Workers.
 */
type Params = unknown[]

export interface SqliteFile {
  /** Rows as objects. */
  all(sql: string, params: Params): Record<string, unknown>[]
  /** Rows as arrays of column values, in select order. */
  values(sql: string, params: Params): unknown[][]
  run(sql: string, params: Params): number
  exec(sql: string): void
}

function result(results: unknown[], changes = 0) {
  return { success: true, results, meta: { changes } }
}

class Statement {
  constructor(
    private readonly file: SqliteFile,
    private readonly sql: string,
    private readonly params: Params = []
  ) {}

  bind(...params: Params): Statement {
    return new Statement(this.file, this.sql, params)
  }

  async all() {
    return result(this.file.all(this.sql, this.params))
  }

  async raw() {
    return this.file.values(this.sql, this.params)
  }

  async first(column?: string) {
    const row = this.file.all(this.sql, this.params)[0]
    if (!row) return null
    return column ? row[column] : row
  }

  async run() {
    return result([], this.file.run(this.sql, this.params))
  }

  /** One statement of a batch: rows when it returns any, else its changes. */
  runInBatch() {
    return result(this.file.all(this.sql, this.params))
  }
}

export function sqliteAsD1(file: SqliteFile): D1Database {
  const database = {
    prepare: (sql: string) => new Statement(file, sql),
    /** Like D1: every statement in one transaction, all or nothing. */
    async batch(statements: Statement[]) {
      file.exec('BEGIN IMMEDIATE')
      try {
        const results = statements.map((statement) => statement.runInBatch())
        file.exec('COMMIT')
        return results
      } catch (error) {
        file.exec('ROLLBACK')
        throw error
      }
    },
    async exec(sql: string) {
      file.exec(sql)
      return { count: 1, duration: 0 }
    },
  }
  return database as unknown as D1Database
}
