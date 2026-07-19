import { hostname } from 'node:os'

import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-sync:${level}] ${message}`)
}

/**
 * SQL expression generating a random 32-char hex id (global sync identity).
 */
const UUID_EXPR = 'lower(hex(randomblob(16)))'

/**
 * Change-tracking triggers only record LOCAL edits: while the sync engine is
 * applying remote changes it sets `sync_state.applying = 1`, which turns every
 * trigger below into a no-op so remote writes are not echoed back as new local
 * changes.
 */
const NOT_APPLYING =
  'COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0'

/** Tables that carry their own sync identity (aggregate roots). */
const ROOT_TABLES: Array<{ table: string; entityType: string }> = [
  { table: 'songs', entityType: 'song' },
  { table: 'song_categories', entityType: 'song_category' },
  { table: 'song_groups', entityType: 'song_group' },
  { table: 'schedules', entityType: 'schedule' },
]

/**
 * Child tables whose edits count as an edit of their aggregate root: the
 * trigger bumps the parent row's `updated_at`, which in turn fires the parent's
 * own pending-trigger. `parentIdExpr` resolves the parent id from a child row
 * (`R` is replaced with NEW/OLD).
 */
const CHILD_TABLES: Array<{
  table: string
  parentTable: string
  parentIdExpr: string
}> = [
  { table: 'song_slides', parentTable: 'songs', parentIdExpr: 'R.song_id' },
  {
    table: 'schedule_items',
    parentTable: 'schedules',
    parentIdExpr: 'R.schedule_id',
  },
  {
    table: 'schedule_bible_passage_verses',
    parentTable: 'schedules',
    parentIdExpr:
      '(SELECT schedule_id FROM schedule_items WHERE id = R.schedule_item_id)',
  },
  {
    table: 'schedule_versete_tineri_entries',
    parentTable: 'schedules',
    parentIdExpr:
      '(SELECT schedule_id FROM schedule_items WHERE id = R.schedule_item_id)',
  },
]

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

function createSyncTables(db: Database): void {
  if (!tableExists(db, 'sync_config')) {
    log('info', 'Creating "sync_config" table...')
    db.run(`
      CREATE TABLE sync_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_enabled INTEGER NOT NULL DEFAULT 0,
        poll_interval_minutes INTEGER NOT NULL DEFAULT 5,
        last_sync_at INTEGER,
        last_error TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  }

  if (!tableExists(db, 'sync_state')) {
    log('info', 'Creating "sync_state" table...')
    db.run(`
      CREATE TABLE sync_state (
        id INTEGER PRIMARY KEY,
        device_id TEXT NOT NULL,
        applying INTEGER NOT NULL DEFAULT 0,
        remote_file_id TEXT,
        remote_file_version TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  }

  // Human-readable device attribution for the sync changes list ("modified on
  // <device>"). Refreshed every boot so renamed machines stay accurate.
  if (!columnExists(db, 'sync_state', 'device_name')) {
    log('info', 'Adding "device_name" column to "sync_state"...')
    db.run(
      "ALTER TABLE sync_state ADD COLUMN device_name TEXT NOT NULL DEFAULT ''",
    )
  }

  // Singleton state row; also resets a stale `applying` flag left behind by a
  // crash mid-apply, which would otherwise disable change tracking forever.
  db.run(`
    INSERT INTO sync_state (id, device_id)
    SELECT 1, ${UUID_EXPR}
    WHERE NOT EXISTS (SELECT 1 FROM sync_state WHERE id = 1)
  `)
  db.run('UPDATE sync_state SET applying = 0 WHERE id = 1 AND applying != 0')
  db.query('UPDATE sync_state SET device_name = ? WHERE id = 1').run(
    safeHostname(),
  )

  if (!tableExists(db, 'sync_pending')) {
    log('info', 'Creating "sync_pending" table...')
    db.run(`
      CREATE TABLE sync_pending (
        entity_type TEXT NOT NULL,
        entity_uuid TEXT NOT NULL,
        queued_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (entity_type, entity_uuid)
      )
    `)
  }

  if (!tableExists(db, 'sync_tombstones')) {
    log('info', 'Creating "sync_tombstones" table...')
    db.run(`
      CREATE TABLE sync_tombstones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_uuid TEXT NOT NULL,
        deleted_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
    db.run(
      'CREATE UNIQUE INDEX idx_sync_tombstones_entity ON sync_tombstones (entity_type, entity_uuid)',
    )
  }

  if (!tableExists(db, 'sync_updates')) {
    log('info', 'Creating "sync_updates" table...')
    db.run(`
      CREATE TABLE sync_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_uuid TEXT NOT NULL,
        local_id INTEGER,
        change_kind TEXT NOT NULL,
        title TEXT NOT NULL,
        occurred_at INTEGER NOT NULL DEFAULT (unixepoch()),
        seen INTEGER NOT NULL DEFAULT 0
      )
    `)
    db.run('CREATE INDEX idx_sync_updates_seen ON sync_updates (seen)')
    db.run(
      'CREATE INDEX idx_sync_updates_entity ON sync_updates (entity_type, entity_uuid)',
    )
  }

  // Which device made the change that was applied here (nullable — older
  // library files carry no attribution).
  if (!columnExists(db, 'sync_updates', 'source_device')) {
    log('info', 'Adding "source_device" column to "sync_updates"...')
    db.run('ALTER TABLE sync_updates ADD COLUMN source_device TEXT')
  }
}

/** Hostname of this machine, or a generic label when unavailable. */
function safeHostname(): string {
  try {
    return hostname() || 'unknown-device'
  } catch {
    return 'unknown-device'
  }
}

function addUuidColumns(db: Database): void {
  for (const { table } of ROOT_TABLES) {
    if (!columnExists(db, table, 'uuid')) {
      log('info', `Adding "uuid" column to "${table}"...`)
      db.run(`ALTER TABLE ${table} ADD COLUMN uuid TEXT NOT NULL DEFAULT ''`)
    }
    // Backfill BEFORE the triggers exist, so assigning identities to existing
    // rows does not bump their updated_at / mark the whole library dirty.
    db.run(`UPDATE ${table} SET uuid = ${UUID_EXPR} WHERE uuid = ''`)
    db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uuid ON ${table} (uuid)`,
    )
  }
}

/**
 * (Re)creates all change-tracking triggers. Dropping first makes the migration
 * self-updating: trigger bodies always match the current app version.
 */
function createTriggers(db: Database): void {
  const statements: string[] = []

  for (const { table, entityType } of ROOT_TABLES) {
    // Assign a sync identity to rows inserted without one. Runs as a separate
    // UPDATE, which fires the pending trigger below with the fresh uuid.
    statements.push(`
      CREATE TRIGGER sync_trg_${table}_uuid_ai AFTER INSERT ON ${table}
      WHEN NEW.uuid = '' AND ${NOT_APPLYING}
      BEGIN
        UPDATE ${table} SET uuid = ${UUID_EXPR} WHERE id = NEW.id;
      END
    `)

    statements.push(`
      CREATE TRIGGER sync_trg_${table}_pending_ai AFTER INSERT ON ${table}
      WHEN NEW.uuid != '' AND ${NOT_APPLYING}
      BEGIN
        INSERT OR REPLACE INTO sync_pending (entity_type, entity_uuid, queued_at)
          VALUES ('${entityType}', NEW.uuid, unixepoch());
        DELETE FROM sync_tombstones
          WHERE entity_type = '${entityType}' AND entity_uuid = NEW.uuid;
      END
    `)

    statements.push(`
      CREATE TRIGGER sync_trg_${table}_pending_au AFTER UPDATE ON ${table}
      WHEN NEW.uuid != '' AND ${NOT_APPLYING}
      BEGIN
        INSERT OR REPLACE INTO sync_pending (entity_type, entity_uuid, queued_at)
          VALUES ('${entityType}', NEW.uuid, unixepoch());
      END
    `)

    // Safety net for write paths that forget to set updated_at themselves —
    // last-writer-wins needs a trustworthy timestamp on every local edit.
    statements.push(`
      CREATE TRIGGER sync_trg_${table}_touch_au AFTER UPDATE ON ${table}
      WHEN NEW.updated_at = OLD.updated_at AND NEW.uuid = OLD.uuid
        AND ${NOT_APPLYING}
      BEGIN
        UPDATE ${table} SET updated_at = unixepoch() WHERE id = NEW.id;
      END
    `)

    statements.push(`
      CREATE TRIGGER sync_trg_${table}_tombstone_ad AFTER DELETE ON ${table}
      WHEN OLD.uuid != '' AND ${NOT_APPLYING}
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity_type, entity_uuid, deleted_at)
          VALUES ('${entityType}', OLD.uuid, unixepoch());
        DELETE FROM sync_pending
          WHERE entity_type = '${entityType}' AND entity_uuid = OLD.uuid;
      END
    `)
  }

  for (const { table, parentTable, parentIdExpr } of CHILD_TABLES) {
    for (const [suffix, rowRef] of [
      ['ai', 'NEW'],
      ['au', 'NEW'],
      ['ad', 'OLD'],
    ] as const) {
      const event = { ai: 'INSERT', au: 'UPDATE', ad: 'DELETE' }[suffix]
      const idExpr = parentIdExpr.replaceAll('R.', `${rowRef}.`)
      // Bumping the parent's updated_at fires the parent's pending trigger, so
      // child edits mark the whole aggregate as changed. When the parent row is
      // mid-cascade-delete the UPDATE matches nothing, which is correct: the
      // parent's own delete trigger records the tombstone.
      statements.push(`
        CREATE TRIGGER sync_trg_${table}_${suffix} AFTER ${event} ON ${table}
        WHEN ${NOT_APPLYING}
        BEGIN
          UPDATE ${parentTable} SET updated_at = unixepoch()
            WHERE id = ${idExpr};
        END
      `)
    }
  }

  for (const statement of statements) {
    const name = statement.match(/CREATE TRIGGER (\S+)/)?.[1]
    if (name) db.run(`DROP TRIGGER IF EXISTS ${name}`)
    db.run(statement)
  }

  log('debug', `Created ${statements.length} sync triggers`)
}

/**
 * Adds everything the Google Drive library sync feature needs:
 * - `uuid` global-identity columns on songs, song_categories, song_groups and
 *   schedules (autoincrement ids are device-local and collide across devices);
 * - the sync engine tables (config, state, pending, tombstones, updates feed);
 * - change-tracking triggers that maintain the dirty set, deletion tombstones
 *   and reliable `updated_at` values used for last-writer-wins merging.
 *
 * Idempotent — safe to run on every boot.
 */
export function addSync(db: Database): void {
  createSyncTables(db)
  addUuidColumns(db)
  createTriggers(db)
}
