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

const EXECUTORS = ['run', 'all', 'get', 'values', 'iterate'] as const

/**
 * Makes the change-tracking triggers stamp who made each change: before a
 * statement runs, `sync_state.acting_user` is set to the user its request
 * acts for (null outside a request: the server itself). Statements run
 * synchronously, so no other request's write can come in between.
 *
 * The value is written only when it differs from the last one, which a
 * transaction may have rolled back: one set inside a transaction is written
 * again after it.
 */
export function stampActingUser(db: Database): void {
  const setActor = db.prepare(
    'UPDATE sync_state SET acting_user = ? WHERE id = 1',
  )
  let current: string | null = null
  let setInTransaction = false
  const sync = () => {
    const wanted = requestActor.getStore()?.userUuid ?? null
    if (wanted === current && !(setInTransaction && !db.inTransaction)) return
    setActor.run(wanted)
    current = wanted
    setInTransaction = db.inTransaction
  }

  const wrapped = new WeakSet<Statement>()
  const wrap = (statement: Statement): Statement => {
    if (wrapped.has(statement)) return statement
    wrapped.add(statement)
    for (const name of EXECUTORS) {
      if (typeof statement[name] !== 'function') continue
      const execute = statement[name].bind(statement) as (
        ...args: unknown[]
      ) => unknown
      Object.assign(statement, {
        [name]: (...args: unknown[]) => {
          sync()
          return execute(...args)
        },
      })
    }
    return statement
  }

  const query = db.query.bind(db)
  const prepare = db.prepare.bind(db)
  const run = db.run.bind(db)
  const exec = db.exec.bind(db)
  Object.assign(db, {
    query: (sql: string) => wrap(query(sql)),
    prepare: (sql: string, ...rest: unknown[]) =>
      wrap((prepare as (...args: unknown[]) => Statement)(sql, ...rest)),
    run: (...args: unknown[]) => {
      sync()
      return (run as (...a: unknown[]) => unknown)(...args)
    },
    exec: (...args: unknown[]) => {
      sync()
      return (exec as (...a: unknown[]) => unknown)(...args)
    },
  })
}
