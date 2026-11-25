import type { SqliteFile } from './sqliteAsD1'

interface FileSystem {
  readdirSync(path: URL): string[]
  readFileSync(path: URL, encoding: 'utf8'): string
}

const NODE_FS = 'node:fs'
// The Workers types have no import.meta.url; Bun and Node do.
const MIGRATIONS_DIR = new URL(
  '../../migrations/',
  (import.meta as unknown as { url: string }).url
)

/**
 * Applies migrations/*.sql in name order, each once, the same files
 * `wrangler d1 migrations apply` runs on Cloudflare.
 */
export async function applyMigrations(file: SqliteFile): Promise<string[]> {
  const fs = (await import(NODE_FS)) as FileSystem
  file.exec(
    'CREATE TABLE IF NOT EXISTS _sync_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
  )
  const applied = new Set(
    file.all('SELECT name FROM _sync_migrations', []).map((row) => row.name)
  )
  const pending = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql') && !applied.has(name))
    .sort()
  for (const name of pending) {
    const sql = fs.readFileSync(new URL(name, MIGRATIONS_DIR), 'utf8')
    file.exec('BEGIN')
    try {
      file.exec(sql)
      file.run('INSERT INTO _sync_migrations (name, applied_at) VALUES (?, ?)', [
        name,
        Math.floor(Date.now() / 1000),
      ])
      file.exec('COMMIT')
    } catch (error) {
      file.exec('ROLLBACK')
      throw error
    }
  }
  return pending
}
