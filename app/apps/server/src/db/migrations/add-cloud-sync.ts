import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-cloud-sync:${level}] ${message}`)
}

function tableExists(db: Database, name: string): boolean {
  return (
    db
      .query<{ name: string }, [string]>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(name) !== null
  )
}

function columnExists(db: Database, table: string, column: string): boolean {
  return (
    db
      .query<{ name: string }, [string]>(
        `SELECT name FROM pragma_table_info('${table}') WHERE name = ?`,
      )
      .get(column) !== null
  )
}

/**
 * Cloud sync (T-171), the library sync's second transport next to Google
 * Drive: which transport syncs, this server's church on the sync service,
 * and the central version of every synced row. Idempotent; runs after
 * add_sync, whose tables it extends.
 */
export function addCloudSync(db: Database): void {
  if (!columnExists(db, 'sync_config', 'transport')) {
    log('info', 'Adding "transport" column to "sync_config"...')
    db.run(
      "ALTER TABLE sync_config ADD COLUMN transport TEXT NOT NULL DEFAULT 'drive'",
    )
  }

  if (!tableExists(db, 'cloud_sync')) {
    log('info', 'Creating "cloud_sync" table...')
    db.run(`
      CREATE TABLE cloud_sync (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        service_url TEXT NOT NULL,
        church_id TEXT NOT NULL,
        read_url TEXT NOT NULL,
        device_id TEXT NOT NULL,
        server_token TEXT NOT NULL,
        seq INTEGER NOT NULL DEFAULT 0,
        head_etag TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  }

  // The church's owner (T-172), kept with its identity so a local backup
  // restores it too.
  if (!columnExists(db, 'cloud_sync', 'owner_email')) {
    log('info', 'Adding "owner_email" column to "cloud_sync"...')
    db.run('ALTER TABLE cloud_sync ADD COLUMN owner_email TEXT')
  }

  // The access mirror's hash (T-172), gone since users and roles sync as
  // changes (T-173).
  if (columnExists(db, 'cloud_sync', 'access_hash')) {
    log('info', 'Dropping "access_hash" column from "cloud_sync"...')
    db.run('ALTER TABLE cloud_sync DROP COLUMN access_hash')
  }

  if (!tableExists(db, 'sync_versions')) {
    log('info', 'Creating "sync_versions" table...')
    db.run(`
      CREATE TABLE sync_versions (
        entity_type TEXT NOT NULL,
        entity_uuid TEXT NOT NULL,
        version INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (entity_type, entity_uuid)
      )
    `)
  }
  log('debug', 'Cloud sync tables ready')
}
