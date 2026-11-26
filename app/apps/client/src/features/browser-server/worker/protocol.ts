/**
 * How the page starts the browser server (browserServer.worker.ts) and
 * hears it boot. Once it is ready, the page and the worker speak the
 * tunnel's protocol (remote-access/tunnel), as with the church PC.
 */

/** The church a joined browser syncs with (its join binding). */
export interface ChurchConnection {
  serviceUrl: string
  churchId: string
  readUrl: string
  /** The device token this browser joined with. */
  token: string
  deviceId: string
  /** The device's user (uuid): who this browser signs in as. */
  userId: string
}

export type StartMessage =
  | { type: 'start'; mode: 'guest' }
  | { type: 'start'; mode: 'church'; church: ChurchConnection }

/** A first start's steps, shown on the loading screen. */
export type BootStep = 'download' | 'seed' | 'sync' | 'search' | 'save'

export type BootMessage =
  | { type: 'progress'; step: BootStep }
  | {
      type: 'ready'
      /** The signed-in user's session token (sent as X-User-Auth). */
      userToken: string
      /** False when this browser can't keep it (no OPFS): memory only. */
      persistent: boolean
    }
  | { type: 'failed'; message: string }
