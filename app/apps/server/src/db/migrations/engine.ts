import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrations:${level}] ${message}`)
}

export interface MigrationResult {
  ftsRecreated?: boolean
}

export interface Migration {
  version: number
  name: string
  up: (db: Database) => MigrationResult
}

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);
`

export function runMigrations(
  db: Database,
  migrations: Migration[],
): MigrationResult {
  db.exec(MIGRATIONS_TABLE_SQL)

  const applied = new Set(
    (db.query('SELECT version FROM _migrations').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  )

  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version)

  let result: MigrationResult = {}

  for (const migration of pending) {
    log('info', `Running migration ${migration.version}: ${migration.name}`)

    const migrationResult = migration.up(db)

    db.run('INSERT INTO _migrations (version, name) VALUES (?, ?)', [
      migration.version,
      migration.name,
    ])

    if (migrationResult.ftsRecreated) {
      result.ftsRecreated = true
    }
  }

  if (pending.length === 0) {
    log('debug', 'No pending migrations')
  } else {
    log('info', `Applied ${pending.length} migration(s)`)
  }

  return result
}
