import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

import { getDatabasePath } from './paths'

/** Response header naming the database that answered (see `getDatabaseId`). */
export const DATABASE_ID_HEADER = 'X-Church-Hub-Database'

let databaseId: string | null = null

/**
 * A short, stable id of this server's database file: the same after a
 * restart, different for every other Church Hub (installed app, dev server,
 * review build). A window that sees it change is talking to another app's
 * server, whose songs are not the ones it lists (T-096). A hash, so the path
 * itself never leaves the machine.
 */
export function getDatabaseId(): string {
  databaseId ??= createHash('sha256')
    .update(resolve(getDatabasePath()))
    .digest('hex')
    .slice(0, 16)
  return databaseId
}
