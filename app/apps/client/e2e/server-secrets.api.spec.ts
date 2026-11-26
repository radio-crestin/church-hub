import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'

/**
 * The signaling host keys are server secrets: they live in server_secrets,
 * which no route reads, and the settings API refuses their names. An install
 * upgraded from a released version loses its old room secrets from
 * app_settings, gets host keys, and is told once that the listener link
 * changed.
 */

test.describe.configure({ mode: 'serial', timeout: 300_000 })

const SECRET_KEYS = [
  'live_translation_stream_secret',
  'live_translation_host_key',
  'remote_access_secret',
  'remote_access_host_key',
  'signaling_host_secret',
]
const OLD_STREAM_SECRET = 'abcdefghijklmnopqrstuvwxyz012345'
const hostedRoomId = (hostKey: string) =>
  `h1${createHash('sha256').update(hostKey).digest('base64url')}`

let server: ExtraServer
let api: APIRequestContext

/** Takes the database back to a released version's, with a shared link. */
function toReleasedShape(databasePath: string) {
  const db = new DatabaseSync(databasePath)
  try {
    db.exec(`
      DROP TABLE server_secrets;
      DELETE FROM __drizzle_migrations WHERE hash = '0035_add_server_secrets';
      DELETE FROM app_settings WHERE key = 'live_translation_link_changed';
    `)
    const insert = db.prepare(
      'INSERT INTO app_settings (key, value) VALUES (?, ?)',
    )
    insert.run('live_translation_stream_secret', OLD_STREAM_SECRET)
    insert.run('remote_access_secret', 'old-remote-access-secret-0123456')
  } finally {
    db.close()
  }
}

function readDatabase<T>(query: string): T[] {
  const db = new DatabaseSync(server.databasePath, { readOnly: true })
  try {
    return db.prepare(query).all() as T[]
  } finally {
    db.close()
  }
}

test.beforeAll(async () => {
  server = new ExtraServer()
  await server.start()
  await server.stop()
  toReleasedShape(server.databasePath)
  await server.start()
  api = await server.adminRequest()
})

test.afterAll(async () => {
  await api?.dispose()
  await server?.dispose()
})

test('the upgrade moves the room secrets out of app_settings', async () => {
  const left = readDatabase<{ key: string }>(
    `SELECT key FROM app_settings WHERE key IN (${SECRET_KEYS.map((k) => `'${k}'`).join()})`,
  )
  expect(left).toEqual([])
})

test('the listener link is a hosted room, and the change is told once', async () => {
  const read = async () =>
    (await (await api.get('/api/live-translation/stream-secret')).json()) as {
      secret: string
      linkChanged: boolean
    }
  const link = await read()
  expect(link.secret).toMatch(/^h1[A-Za-z0-9_-]{43}$/)
  expect(link.secret).not.toContain(OLD_STREAM_SECRET)
  expect(link.linkChanged).toBe(true)

  const keys = readDatabase<{ key: string; value: string }>(
    'SELECT key, value FROM server_secrets',
  )
  const liveKey = keys.find((k) => k.key === 'live_translation_host_key')
  expect(liveKey && hostedRoomId(liveKey.value)).toBe(link.secret)

  expect((await api.delete('/api/live-translation/link-changed')).ok()).toBe(
    true,
  )
  expect((await read()).linkChanged).toBe(false)
})

test('remote access opens a hosted room with a key the API never returns', async () => {
  const { data } = await (await api.get('/api/remote-access')).json()
  expect(data.secret).toMatch(/^h1[A-Za-z0-9_-]{43}$/)
  const keys = readDatabase<{ key: string; value: string }>(
    "SELECT value FROM server_secrets WHERE key = 'remote_access_host_key'",
  )
  expect(keys).toHaveLength(1)
  expect(hostedRoomId(keys[0].value)).toBe(data.secret)
  expect(JSON.stringify(data)).not.toContain(keys[0].value)
})

test('the settings API never reads, lists, writes or deletes a secret key', async () => {
  const hostKeys = readDatabase<{ value: string }>(
    'SELECT value FROM server_secrets',
  ).map((k) => k.value)
  expect(hostKeys.length).toBeGreaterThan(0)

  for (const key of SECRET_KEYS) {
    const get = await api.get(`/api/settings/app_settings/${key}`)
    expect(get.status()).toBe(403)
    const post = await api.post('/api/settings/app_settings', {
      data: { key, value: 'x' },
    })
    expect(post.status()).toBe(403)
    const del = await api.delete(`/api/settings/app_settings/${key}`)
    expect(del.status()).toBe(403)
  }

  for (const table of ['app_settings', 'server_secrets']) {
    const list = await (await api.get(`/api/settings/${table}`)).text()
    for (const key of SECRET_KEYS) expect(list).not.toContain(`"${key}"`)
    for (const hostKey of hostKeys) expect(list).not.toContain(hostKey)
  }
  const one = await api.get(
    '/api/settings/server_secrets/live_translation_host_key',
  )
  for (const hostKey of hostKeys) {
    expect(await one.text()).not.toContain(hostKey)
  }
})

test('a restart keeps the listener link and the pairing code', async () => {
  const links = async () => ({
    listener: (
      await (await api.get('/api/live-translation/stream-secret')).json()
    ).secret as string,
    pairing: (await (await api.get('/api/remote-access')).json()).data
      .secret as string,
  })
  const before = await links()
  await api.dispose()
  await server.stop()
  await server.start()
  api = await server.adminRequest()
  expect(await links()).toEqual(before)
})
