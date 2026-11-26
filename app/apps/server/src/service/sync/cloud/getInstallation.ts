import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join } from 'node:path'

import { getDatabasePath } from '../../../utils/paths'

export interface Installation {
  /** Random id of this install of the app on this PC. */
  id: string
  /** The PC's name, shown to another PC holding the same church. */
  name: string
}

const FILE_NAME = 'installation-id'
const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/

let cached: Installation | null = null

/**
 * This install's id, kept in a file next to the database, never inside it:
 * a backup restored on another PC brings the church's server token along,
 * but not this id, so the sync service can tell the two PCs apart (T-172).
 * Null in a browser, a device with a token of its own (its build swaps this
 * file: client browserServerBuild.ts).
 */
export function getInstallation(): Installation | null {
  if (cached) return cached
  const path = join(dirname(getDatabasePath()), FILE_NAME)
  let id = existsSync(path) ? readFileSync(path, 'utf8').trim() : ''
  if (!VALID_ID.test(id)) {
    id = randomBytes(16).toString('base64url')
    writeFileSync(path, id)
  }
  cached = { id, name: hostname() }
  return cached
}
