/** Another tab of this browser runs the server already. */
export class OtherTabError extends Error {
  constructor() {
    super('church_hub_open_in_another_tab')
  }
}

/**
 * Only one tab may run the browser server: its OPFS database can be open in
 * one place at a time. Held for the page's life (a Web Lock); a second tab
 * is refused (OtherTabError) instead of starting a database of its own.
 */
export function holdServerLock(): Promise<void> {
  if (!('locks' in navigator)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    void navigator.locks.request(
      'church-hub-browser-server',
      { ifAvailable: true },
      (lock) => {
        if (!lock) {
          reject(new OtherTabError())
          return
        }
        resolve()
        return new Promise(() => {})
      },
    )
  })
}
