/**
 * `node:async_hooks` in the browser build: the AsyncLocalStorage the server
 * keeps each request's acting user in (db/actingUser.ts). A browser has no
 * async context, so the store is the last one a `run` began, and it stays
 * after `run` returns: every request in a browser is its one signed-in
 * user's, so a write after an await is still stamped with that user.
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined

  run<R>(store: T, callback: () => R): R {
    this.store = store
    return callback()
  }

  getStore(): T | undefined {
    return this.store
  }
}

export default { AsyncLocalStorage }
