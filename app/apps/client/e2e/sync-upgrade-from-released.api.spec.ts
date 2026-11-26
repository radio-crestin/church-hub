import { readFileSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { gunzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import { SYNCED_SETTING_KEYS } from '../../server/src/service/sync/syncedTables'

/**
 * A church on the released app, already syncing, updates to the version
 * that syncs every table (T-173). The database is one v0.1.105 made: one
 * row of each kind saved through its own API, Drive sync turned on, then
 * slimmed (seeded songs and verses removed, user tokens replaced). The
 * start-up migrations give the old rows their sync identity, replace the
 * released triggers, queue the newly synced rows once, and change nothing
 * on the next start.
 */

const RELEASED_DB = new URL(
  './fixtures/released-v0.1.105.db.gz',
  import.meta.url,
)

/** The tables T-173 syncs that v0.1.105 didn't, each with a released row. */
const NEW_TABLES: Record<string, string> = {
  roles: 'role',
  users: 'user',
  song_tags: 'song_tag',
  song_bookmarks: 'song_bookmark',
  song_bookmark_notes: 'song_bookmark_note',
  bible_bookmarks: 'bible_bookmark',
  bible_bookmark_notes: 'bible_bookmark_note',
  music_playlists: 'music_playlist',
}

test.describe.configure({ mode: 'serial', timeout: 600_000 })

let server: ExtraServer

test.beforeAll(() => {
  server = new ExtraServer()
  writeFileSync(server.databasePath, gunzipSync(readFileSync(RELEASED_DB)))
  // A build of main before T-173 kept a hash of the access it mirrored.
  const db = new DatabaseSync(server.databasePath)
  db.exec(`CREATE TABLE cloud_sync (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    service_url TEXT NOT NULL,
    church_id TEXT NOT NULL,
    read_url TEXT NOT NULL,
    device_id TEXT NOT NULL,
    server_token TEXT NOT NULL,
    seq INTEGER NOT NULL DEFAULT 0,
    head_etag TEXT,
    access_hash TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`)
  db.close()
})

test.afterAll(async () => {
  await server?.dispose()
})

function readDatabase<T>(read: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(server.databasePath)
  try {
    return read(db)
  } finally {
    db.close()
  }
}

test('the released database upgrades: identities, triggers, the rows queued once', async () => {
  await server.start()
  const api = await server.adminRequest()

  // An edit after the update is queued with who made it.
  const tags = (await (await api.get('/api/song-tags')).json()).data as {
    id: number
    name: string
  }[]
  const tag = tags.find((candidate) => candidate.name === 'Released tag')
  expect(tag, 'the released tag is kept').toBeTruthy()
  const renamed = await api.post('/api/song-tags', {
    data: { id: tag?.id, name: 'Released tag, renamed' },
  })
  expect(renamed.ok()).toBe(true)
  // A synced setting saved twice: the triggers queue it with an upsert.
  for (const value of ['[["a","b"]]', '[["c","d"]]']) {
    const saved = await api.post('/api/settings/app_settings', {
      data: { key: 'search_synonyms', value },
    })
    expect(saved.ok(), server.log.slice(-2000)).toBe(true)
  }
  await api.dispose()
  await server.stop()
  expect(server.log).not.toContain('[add-sync:error]')

  readDatabase((db) => {
    for (const table of Object.keys(NEW_TABLES)) {
      const { rows, missing, unique } = db
        .prepare(
          `SELECT COUNT(*) AS rows, SUM(uuid = '') AS missing,
                  COUNT(DISTINCT uuid) AS "unique" FROM ${table}`,
        )
        .get() as { rows: number; missing: number; unique: number }
      expect(rows, `${table} keeps its released rows`).toBeGreaterThan(0)
      expect(missing, `${table} rows all have a uuid`).toBe(0)
      expect(unique, `${table} uuids are unique`).toBe(rows)
    }
    for (const table of ['song_bookmarks', 'bible_bookmark_notes']) {
      const { stale } = db
        .prepare(
          `SELECT COUNT(*) AS stale FROM ${table} WHERE updated_at != created_at`,
        )
        .get() as { stale: number }
      expect(stale, `${table}.updated_at starts as created_at`).toBe(0)
    }

    const triggers = db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_trg_%'",
      )
      .all() as { name: string; sql: string }[]
    const names = triggers.map((trigger) => trigger.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'sync_trg_songs_pending_au',
        'sync_trg_song_tags_pending_ai',
        'sync_trg_users_pending_au',
        'sync_trg_app_settings_pending_au',
        'sync_trg_user_permissions_ai',
      ]),
    )
    for (const trigger of triggers) {
      expect(trigger.sql, trigger.name).not.toContain('OR REPLACE')
    }

    // Sync was on: the newly synced rows were queued for its other devices.
    const pending = db
      .prepare('SELECT entity_type, entity_uuid, author FROM sync_pending')
      .all() as { entity_type: string; entity_uuid: string; author: string }[]
    const types = new Set(pending.map((row) => row.entity_type))
    for (const type of [...Object.values(NEW_TABLES), 'setting']) {
      expect(types, `${type} queued`).toContain(type)
    }
    const settings = pending
      .filter((row) => row.entity_type === 'setting')
      .map((row) => row.entity_uuid)
    expect(settings).toContain('search_synonyms')
    for (const key of settings) {
      expect(SYNCED_SETTING_KEYS as readonly string[]).toContain(key)
    }

    const { uuid: tagUuid } = db
      .prepare(
        "SELECT uuid FROM song_tags WHERE name = 'Released tag, renamed'",
      )
      .get() as { uuid: string }
    const { uuid: adminUuid } = db
      .prepare('SELECT uuid FROM users WHERE is_super_admin = 1')
      .get() as { uuid: string }
    expect(
      pending.find((row) => row.entity_uuid === tagUuid)?.author,
      'the rename is the admin’s',
    ).toBe(adminUuid)

    const accessHash = db
      .prepare(
        "SELECT COUNT(*) AS n FROM pragma_table_info('cloud_sync') WHERE name = 'access_hash'",
      )
      .get() as { n: number }
    expect(accessHash.n).toBe(0)

    db.exec('DELETE FROM sync_pending')
  })
})

test('the next start changes nothing', async () => {
  const before = readDatabase((db) =>
    db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE name LIKE 'sync_%' OR name LIKE 'idx_%_uuid' ORDER BY name",
      )
      .all(),
  )

  await server.start()
  await server.stop()

  readDatabase((db) => {
    const { n } = db
      .prepare('SELECT COUNT(*) AS n FROM sync_pending')
      .get() as {
      n: number
    }
    expect(n, 'nothing queued again').toBe(0)
    expect(
      db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE name LIKE 'sync_%' OR name LIKE 'idx_%_uuid' ORDER BY name",
        )
        .all(),
    ).toEqual(before)
  })
})
