/**
 * The part of `bun:sqlite` the server uses, on top of sqlite-wasm's
 * synchronous oo1 API. Inside a Web Worker sqlite-wasm is synchronous, so the
 * server's synchronous service layer (raw `query().all()` and drizzle's
 * `bun-sqlite` driver) runs on it unchanged.
 */
import type {
  PreparedStatement,
  Database as WasmDatabase,
} from '@sqlite.org/sqlite-wasm'

type Bindable = string | number | bigint | boolean | null | Uint8Array
type Params = unknown[]

let wasmDatabaseFactory: (() => WasmDatabase) | null = null
let lastInsertRowid: (db: WasmDatabase) => number = () => 0

/** Set once by the worker: how `new Database()` opens the OPFS file. */
export function configureShim(
  factory: () => WasmDatabase,
  insertRowid: (db: WasmDatabase) => number,
): void {
  wasmDatabaseFactory = factory
  lastInsertRowid = insertRowid
}

function toBinding(
  params: Params,
): Bindable[] | Record<string, Bindable> | undefined {
  if (params.length === 0) return undefined
  const [first] = params
  if (params.length === 1 && Array.isArray(first)) return normalizeList(first)
  if (
    params.length === 1 &&
    first !== null &&
    typeof first === 'object' &&
    !(first instanceof Uint8Array)
  ) {
    const named: Record<string, Bindable> = {}
    for (const [key, value] of Object.entries(first)) {
      named[/^[$:@]/.test(key) ? key : `$${key}`] = normalize(value)
    }
    return named
  }
  return normalizeList(params)
}

function normalizeList(values: unknown[]): Bindable[] {
  return values.map(normalize)
}

function normalize(value: unknown): Bindable {
  if (value === undefined) return null
  if (value instanceof Date) return Math.floor(value.getTime() / 1000)
  return value as Bindable
}

export class Statement {
  constructor(
    private readonly owner: Database,
    private readonly stmt: PreparedStatement,
  ) {}

  private bound(params: Params): PreparedStatement {
    this.stmt.reset(true)
    const binding = toBinding(params)
    if (binding !== undefined) this.stmt.bind(binding as never)
    return this.stmt
  }

  all(...params: Params): Record<string, unknown>[] {
    const stmt = this.bound(params)
    const rows: Record<string, unknown>[] = []
    while (stmt.step()) rows.push(stmt.get({}) as Record<string, unknown>)
    stmt.reset()
    return rows
  }

  get(...params: Params): Record<string, unknown> | null {
    const stmt = this.bound(params)
    const row = stmt.step() ? (stmt.get({}) as Record<string, unknown>) : null
    stmt.reset()
    return row
  }

  values(...params: Params): unknown[][] {
    const stmt = this.bound(params)
    const rows: unknown[][] = []
    while (stmt.step()) rows.push(stmt.get([]) as unknown[])
    stmt.reset()
    return rows
  }

  run(...params: Params): { changes: number; lastInsertRowid: number } {
    const stmt = this.bound(params)
    while (stmt.step()) {
      // A RETURNING clause run through run(): its rows are dropped, as in bun.
    }
    stmt.reset()
    return this.owner.lastChange()
  }

  *iterate(...params: Params): IterableIterator<Record<string, unknown>> {
    const stmt = this.bound(params)
    try {
      while (stmt.step()) yield stmt.get({}) as Record<string, unknown>
    } finally {
      stmt.reset()
    }
  }

  finalize(): void {
    this.stmt.finalize()
  }
}

type TransactionFn<A extends unknown[], R> = ((...args: A) => R) & {
  deferred: (...args: A) => R
  immediate: (...args: A) => R
  exclusive: (...args: A) => R
}

export class Database {
  readonly filename: string
  private readonly db: WasmDatabase
  private readonly cache = new Map<string, Statement>()
  private savepointDepth = 0

  constructor(filename = ':memory:') {
    if (!wasmDatabaseFactory) throw new Error('bun:sqlite shim not configured')
    this.filename = filename
    this.db = wasmDatabaseFactory()
  }

  get inTransaction(): boolean {
    return this.savepointDepth > 0
  }

  /** The wrapped sqlite-wasm handle, for the bench's own measurements. */
  get wasm(): WasmDatabase {
    return this.db
  }

  lastChange(): { changes: number; lastInsertRowid: number } {
    return {
      changes: this.db.changes(),
      lastInsertRowid: lastInsertRowid(this.db),
    }
  }

  query(sql: string): Statement {
    let stmt = this.cache.get(sql)
    if (!stmt) {
      stmt = new Statement(this, this.db.prepare(sql))
      this.cache.set(sql, stmt)
    }
    return stmt
  }

  prepare(sql: string): Statement {
    return new Statement(this, this.db.prepare(sql))
  }

  run(
    sql: string,
    ...params: Params
  ): { changes: number; lastInsertRowid: number } {
    if (params.length === 0) {
      this.db.exec(sql)
      return this.lastChange()
    }
    const stmt = this.prepare(sql)
    try {
      return stmt.run(...params)
    } finally {
      stmt.finalize()
    }
  }

  exec(
    sql: string,
    ...params: Params
  ): { changes: number; lastInsertRowid: number } {
    return this.run(sql, ...params)
  }

  transaction<A extends unknown[], R>(
    fn: (...args: A) => R,
  ): TransactionFn<A, R> {
    const wrap =
      (begin: string) =>
      (...args: A): R => {
        const nested = this.savepointDepth > 0
        const savepoint = `bun_sp_${this.savepointDepth}`
        this.db.exec(nested ? `SAVEPOINT ${savepoint}` : begin)
        this.savepointDepth++
        try {
          const result = fn(...args)
          this.db.exec(nested ? `RELEASE ${savepoint}` : 'COMMIT')
          return result
        } catch (error) {
          this.db.exec(
            nested
              ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`
              : 'ROLLBACK',
          )
          throw error
        } finally {
          this.savepointDepth--
        }
      }
    return Object.assign(wrap('BEGIN'), {
      deferred: wrap('BEGIN DEFERRED'),
      immediate: wrap('BEGIN IMMEDIATE'),
      exclusive: wrap('BEGIN EXCLUSIVE'),
    })
  }

  close(): void {
    for (const stmt of this.cache.values()) stmt.finalize()
    this.cache.clear()
    this.db.close()
  }
}

export default { Database }
