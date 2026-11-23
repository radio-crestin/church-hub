#!/usr/bin/env bun
/**
 * Takes a consistent copy of the installed Church Hub's database while it
 * runs (SQLite `VACUUM INTO`: read-only on the live database, nothing in its
 * folder changes), checks it, and prints its counts. Used to refresh the test
 * machine's copy of Adunare PC's data (docs/test-machine.md).
 *
 * Usage: bun app/scripts/snapshot-db.ts <out dir> [<data dir>]
 *   <data dir> defaults to the installed app's: %APPDATA%\church-hub on Windows.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { Database } from 'bun:sqlite'

const COUNTED = ['songs', 'schedules', 'schedule_items', 'users', 'screens']

function installedDataDir(): string {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'church-hub')
  }
  if (process.platform === 'win32') {
    return join(
      process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      'church-hub',
    )
  }
  return join(homedir(), '.config', 'church-hub')
}

const [outArg, dataArg] = process.argv.slice(2)
if (!outArg) {
  throw new Error(
    'usage: bun app/scripts/snapshot-db.ts <out dir> [<data dir>]',
  )
}
const out = join(resolve(outArg), 'app.db')
if (existsSync(out)) throw new Error(`${out} already exists`)
mkdirSync(resolve(outArg), { recursive: true })

const live = new Database(join(dataArg ?? installedDataDir(), 'app.db'), {
  readonly: true,
})
live.exec('PRAGMA busy_timeout = 20000')
live.run('VACUUM INTO ?', [out])
live.close()

const copy = new Database(out, { readonly: true })
const integrity = copy.query('PRAGMA integrity_check').get() as {
  integrity_check: string
}
if (integrity.integrity_check !== 'ok') {
  throw new Error(`the copy is damaged: ${integrity.integrity_check}`)
}
const counts = COUNTED.map(
  (table) =>
    `${table} ${(copy.query(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n}`,
)
copy.close()
// biome-ignore lint/suspicious/noConsole: the script's result
console.log(`${out}: integrity ok; ${counts.join(', ')}`)
