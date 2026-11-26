import { AsyncLocalStorage } from 'node:async_hooks'

import type { Database, Statement } from 'bun:sqlite'

/** The request a statement runs for: who it acts for, once authenticated. */
interface RequestActor {
  /** The user's sync uuid; null: nobody (the server itself). */
  userUuid: string | null
}

const requestActor = new AsyncLocalStorage<RequestActor>()

/** Runs one request's handler with its own actor (none until it signs in). */
export function runAsRequest<T>(handler: () => T): T {
  return requestActor.run({ userUuid: null }, handler)
}

/** The signed-in user the current request acts for, from now on. */
export function setRequestActor(userUuid: string | null): void {
  const actor = requestActor.getStore()
  if (actor) actor.userUuid = userUuid
}

const EXECUTORS = ['run', 'all', 'get', 'values'] as const

/** Statements that can change a row, and so fire the triggers. */
const WRITE = /^\s*(insert|update|delete|replace)\b/i

/**
 * Makes the change-tracking triggers stamp who made each change: each write
 * first sets `sync_state.acting_user` to the user its request acts for (null
 * outside a request: the server itself), in the same transaction. The row is
 * shared by every connection (a worker thread has its own), so the value is
 * written with the write's own lock held, never cached.
 */
export function stampActingUser(db: Database): void {
  const setActor = db.prepare(
    'UPDATE sync_state SET acting_user = ?1 WHERE id = 1 AND acting_user IS NOT ?1',
  )
  const begin = db.prepare('BEGIN IMMEDIATE')
  const commit = db.prepare('COMMIT')
  const rollback = db.prepare('ROLLBACK')
  const stamped = <T>(execute: () => T): T => {
    const actor = requestActor.getStore()?.userUuid ?? null
    if (db.inTransaction) {
      setActor.run(actor)
      return execute()
    }
    begin.run()
    try {
      setActor.run(actor)
      const result = execute()
      commit.run()
      return result
    } catch (error) {
      if (db.inTransaction) rollback.run()
      throw error
    }
  }

  const wrap = (sql: string, statement: Statement): Statement => {
    if (!WRITE.test(sql)) return statement
    for (const name of EXECUTORS) {
      const execute = statement[name].bind(statement) as (
        ...args: unknown[]
      ) => unknown
      Object.assign(statement, {
        [name]: (...args: unknown[]) => stamped(() => execute(...args)),
      })
    }
    return statement
  }

  const wrapped = new WeakSet<Statement>()
  const query = db.query.bind(db)
  const prepare = db.prepare.bind(db)
  const run = db.run.bind(db) as (sql: string, ...rest: unknown[]) => unknown
  const runStamped = (sql: string, ...rest: unknown[]) =>
    WRITE.test(sql) ? stamped(() => run(sql, ...rest)) : run(sql, ...rest)
  Object.assign(db, {
    // query() caches its statement: wrapped once, the first time.
    query: (sql: string) => {
      const statement = query(sql)
      return wrapped.has(statement)
        ? statement
        : (wrapped.add(statement), wrap(sql, statement))
    },
    prepare: (sql: string, ...rest: unknown[]) =>
      wrap(sql, (prepare as (...args: unknown[]) => Statement)(sql, ...rest)),
    run: runStamped,
    exec: runStamped,
  })
}
