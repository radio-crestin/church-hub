import { createHash } from 'node:crypto'
import { copyFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  type APIRequestContext,
  type APIResponse,
  expect,
  test,
} from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import { openSealed, SEALED } from './helpers/sealed-secrets'

/**
 * Saved secrets are sealed at rest (service/secret-store). An install
 * upgraded from a version that kept them in plain text has them sealed on
 * its first start, with no plain copy left anywhere in its database files,
 * and every feature keeps working. The settings API never returns them. A
 * backup restored on the same computer opens; one restored on another
 * computer can't, so its features ask to be set up again.
 */

test.describe.configure({ mode: 'serial', timeout: 600_000 })

const MASK = '••••••••'
const SECRETS = {
  liveHostKey: 'e2e-live-host-key-plain-0123456789abcdefABCDEF',
  remoteHostKey: 'e2e-remote-host-key-plain-0123456789abcdefABCD',
  aiKey: 'church-ai-key-not-from-the-repo',
  geminiKey: 'e2e-gemini-key-plain-0123456789',
  openaiKey: 'church-openai-key-not-from-the-repo',
  obsPassword: 'e2e-obs-password-plain-01234',
  youtubeAccess: 'ya29.e2e-youtube-access-plain-0123',
  youtubeRefresh: '1//e2e-youtube-refresh-plain-0123',
  driveAccess: 'ya29.e2e-drive-access-plain-0123',
  driveRefresh: '1//e2e-drive-refresh-plain-0123',
  cloudToken: 'chs_e2e-cloud-token-plain-0123456789',
  cloudReadPath: 'e2e-read-path-secret-plain-0123456789abcdef',
  s3Secret: 'e2e-s3-secret-access-key-plain-0123',
  adminToken: 'usr_e2e-admin-token-plain-0123456789abcdef',
  systemToken: 'sys_e2e-system-token-plain-0123456789abcd',
  deleted: 'e2e-deleted-secret-plain-0123456789',
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')
const hostedRoomId = (hostKey: string) =>
  `h1${createHash('sha256').update(hostKey).digest('base64url')}`

let computerA: ExtraServer
let computerB: ExtraServer
let apiA: APIRequestContext
let apiB: APIRequestContext

function withDatabase<T>(path: string, use: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(path)
  try {
    return use(db)
  } finally {
    db.close()
  }
}

/** The database as a version that kept secrets in plain text left it. */
function toPlainTextShape(databasePath: string) {
  withDatabase(databasePath, (db) => {
    const now = Math.floor(Date.now() / 1000)
    const setting = db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    const serverSecret = db.prepare(
      'INSERT OR REPLACE INTO server_secrets (key, value) VALUES (?, ?)',
    )
    serverSecret.run('live_translation_host_key', SECRETS.liveHostKey)
    serverSecret.run('remote_access_host_key', SECRETS.remoteHostKey)
    // A secret deleted before the update: its bytes linger in a free page.
    serverSecret.run('deleted_secret', SECRETS.deleted)
    db.exec("DELETE FROM server_secrets WHERE key = 'deleted_secret'")
    setting.run(
      'songs_ai_search_config',
      JSON.stringify({
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.2',
        apiKey: SECRETS.aiKey,
        baseUrl: '',
      }),
    )
    setting.run(
      'live_translation_settings',
      JSON.stringify({
        engine: 'gemini',
        sourceLanguage: 'ro',
        targets: [{ id: 't1', targetLanguage: 'en', voiceName: 'Kore' }],
        geminiApiKey: SECRETS.geminiKey,
        openaiApiKey: SECRETS.openaiKey,
      }),
    )
    db.exec('DELETE FROM obs_config')
    db.prepare(
      "INSERT INTO obs_config (host, port, password, auto_connect) VALUES ('127.0.0.1', 4455, ?, 0)",
    ).run(SECRETS.obsPassword)
    db.prepare(
      "INSERT INTO youtube_auth (access_token, refresh_token, expires_at, channel_name) VALUES (?, ?, ?, 'E2E channel')",
    ).run(SECRETS.youtubeAccess, SECRETS.youtubeRefresh, now + 86_400)
    db.prepare(
      "INSERT INTO google_drive_auth (access_token, refresh_token, expires_at, email) VALUES (?, ?, ?, 'e2e@example.com')",
    ).run(SECRETS.driveAccess, SECRETS.driveRefresh, now + 86_400)
    db.prepare(
      `INSERT INTO cloud_sync (id, service_url, church_id, read_url, device_id, server_token)
       VALUES (1, 'http://127.0.0.1:9', 'church-e2e', ?, 'device-e2e', ?)`,
    ).run(
      `http://127.0.0.1:9/churches/church-e2e-${SECRETS.cloudReadPath}`,
      SECRETS.cloudToken,
    )
    db.prepare(
      `INSERT INTO song_source_storage (id, endpoint, bucket, access_key_id, secret_access_key, public_base_url)
       VALUES (1, 'http://127.0.0.1:9', 'e2e-bucket', 'AKIAE2E', ?, 'http://127.0.0.1:9/e2e-bucket')`,
    ).run(SECRETS.s3Secret)
    db.prepare(
      'UPDATE users SET token = ?, token_hash = ? WHERE is_super_admin = 1',
    ).run(SECRETS.adminToken, sha256(SECRETS.adminToken))
    db.prepare(
      'UPDATE app_sessions SET session_token = ?, session_token_hash = ?',
    ).run(SECRETS.systemToken, sha256(SECRETS.systemToken))
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  })
  // An older version's copy kept before its own upgrade.
  copyFileSync(
    databasePath,
    `${databasePath.replace(/app\.db$/, '')}app-v0.0.1.db`,
  )
}

/** Every database file of a data folder: app.db, its WAL, the copies. */
const databaseFiles = (dataDir: string) =>
  readdirSync(dataDir)
    .filter((name) => /^app.*\.db/.test(name))
    .map((name) => join(dataDir, name))

function plainSecretsIn(dataDir: string): string[] {
  const found: string[] = []
  for (const path of databaseFiles(dataDir)) {
    const bytes = readFileSync(path)
    for (const [name, secret] of Object.entries(SECRETS)) {
      if (bytes.includes(Buffer.from(secret))) found.push(`${name} in ${path}`)
    }
  }
  return found
}

function storedValue(databasePath: string, query: string): string {
  return withDatabase(databasePath, (db) => {
    const row = db.prepare(query).get() as { value: string } | undefined
    if (!row) throw new Error(`no row for ${query}`)
    return row.value
  })
}

const openStored = (query: string, place: string) => {
  const stored = storedValue(computerA.databasePath, query)
  expect(stored, place).toMatch(SEALED)
  return openSealed(computerA.databasePath, stored, place)
}

const json = async (response: Promise<APIResponse>) => (await response).json()

test.beforeAll(async () => {
  computerA = new ExtraServer()
  await computerA.start()
  await computerA.stop()
  toPlainTextShape(computerA.databasePath)
  await computerA.start()
  await computerA.stop()
})

test.afterAll(async () => {
  await apiA?.dispose()
  await apiB?.dispose()
  await computerA?.dispose()
  await computerB?.dispose()
})

test('the first start seals every secret and leaves no plain copy', async () => {
  expect(plainSecretsIn(computerA.dataDir)).toEqual([])
  if (process.platform !== 'win32') {
    const mode = statSync(join(computerA.dataDir, 'secret-key.json')).mode
    expect(mode & 0o777).toBe(0o600)
  }

  expect(
    openStored(
      "SELECT value FROM server_secrets WHERE key = 'live_translation_host_key'",
      'server_secrets.value:live_translation_host_key',
    ),
  ).toBe(SECRETS.liveHostKey)
  expect(
    openStored(
      'SELECT refresh_token AS value FROM youtube_auth',
      'youtube_auth.refresh_token',
    ),
  ).toBe(SECRETS.youtubeRefresh)
  expect(
    openStored(
      'SELECT refresh_token AS value FROM google_drive_auth',
      'google_drive_auth.refresh_token',
    ),
  ).toBe(SECRETS.driveRefresh)
  expect(
    openStored(
      'SELECT server_token AS value FROM cloud_sync',
      'cloud_sync.server_token',
    ),
  ).toBe(SECRETS.cloudToken)
  expect(
    openStored(
      'SELECT read_url AS value FROM cloud_sync',
      'cloud_sync.read_url',
    ),
  ).toContain(SECRETS.cloudReadPath)
  expect(
    openStored(
      'SELECT secret_access_key AS value FROM song_source_storage',
      'song_source_storage.secret_access_key',
    ),
  ).toBe(SECRETS.s3Secret)
  expect(
    openStored(
      'SELECT session_token AS value FROM app_sessions',
      'app_sessions.session_token:System API Token',
    ),
  ).toBe(SECRETS.systemToken)
  expect(
    openStored(
      'SELECT token AS value FROM users WHERE is_super_admin = 1',
      `users.token:${sha256(SECRETS.adminToken)}`,
    ),
  ).toBe(SECRETS.adminToken)

  // A value moved to another row no longer opens.
  const remote = storedValue(
    computerA.databasePath,
    "SELECT value FROM server_secrets WHERE key = 'remote_access_host_key'",
  )
  expect(() =>
    openSealed(
      computerA.databasePath,
      remote,
      'server_secrets.value:live_translation_host_key',
    ),
  ).toThrow()
})

test('after the restart every feature still uses its secret', async () => {
  await computerA.start()
  apiA = await computerA.adminRequest()

  const listener = await json(apiA.get('/api/live-translation/stream-secret'))
  expect(listener.secret).toBe(hostedRoomId(SECRETS.liveHostKey))
  const pairing = await json(apiA.get('/api/remote-access'))
  expect(pairing.data.secret).toBe(hostedRoomId(SECRETS.remoteHostKey))

  const obs = await json(apiA.get('/api/livestream/obs/config'))
  expect(obs.data.password).toBe(SECRETS.obsPassword)

  const youtube = await json(apiA.get('/api/livestream/youtube/status'))
  expect(youtube.data).toMatchObject({
    isAuthenticated: true,
    channelName: 'E2E channel',
  })

  const users = await json(apiA.get('/api/users'))
  const admin = (users.data as { isSuperAdmin: boolean; token: string }[]).find(
    (u) => u.isSuperAdmin,
  )
  expect(admin?.token).toBe(SECRETS.adminToken)

  const storage = await json(apiA.get('/api/song-sources/storage'))
  expect(storage.data).toMatchObject({ hasSecret: true })
  expect(JSON.stringify(storage)).not.toContain(SECRETS.s3Secret)

  const status = await json(apiA.get('/api/secret-store'))
  expect(status.data).toEqual({
    keptIn: 'file',
    locked: false,
    resetFeatures: [],
  })
})

test('the settings API masks saved keys; the mask keeps them, empty clears', async () => {
  const one = await json(
    apiA.get('/api/settings/app_settings/songs_ai_search_config'),
  )
  expect(JSON.parse(one.data.value).apiKey).toBe(MASK)
  const list = await (await apiA.get('/api/settings/app_settings')).text()
  const translation = await (
    await apiA.get('/api/live-translation/settings')
  ).text()
  for (const body of [list, translation]) {
    for (const secret of Object.values(SECRETS)) {
      expect(body).not.toContain(secret)
    }
  }
  expect(JSON.parse(translation)).toMatchObject({
    geminiApiKey: MASK,
    openaiApiKey: MASK,
  })

  const read = () =>
    JSON.parse(
      storedValue(
        computerA.databasePath,
        "SELECT value FROM app_settings WHERE key = 'songs_ai_search_config'",
      ),
    ) as { apiKey: string; model: string }
  const save = (config: Record<string, unknown>) =>
    apiA.post('/api/settings/app_settings', {
      data: { key: 'songs_ai_search_config', value: JSON.stringify(config) },
    })

  // The form sends the mask back with another change: the key stays.
  expect(
    (await save({ ...JSON.parse(one.data.value), model: 'gpt-e2e' })).ok(),
  ).toBe(true)
  expect(read().model).toBe('gpt-e2e')
  expect(read().apiKey).toMatch(SEALED)
  const aiStored = JSON.parse(
    storedValue(
      computerA.databasePath,
      "SELECT value FROM app_settings WHERE key = 'songs_ai_search_config'",
    ),
  ).apiKey as string
  expect(
    openSealed(
      computerA.databasePath,
      aiStored,
      'app_settings.value:songs_ai_search_config.apiKey',
    ),
  ).toBe(SECRETS.aiKey)

  // A new key is sealed; an empty one clears it.
  expect(
    (
      await save({ ...read(), apiKey: 'church-new-ai-key-not-from-the-repo' })
    ).ok(),
  ).toBe(true)
  expect(plainSecretsIn(computerA.dataDir)).toEqual([])
  expect(
    openSealed(
      computerA.databasePath,
      read().apiKey,
      'app_settings.value:songs_ai_search_config.apiKey',
    ),
  ).toBe('church-new-ai-key-not-from-the-repo')
  expect((await save({ ...read(), apiKey: '' })).ok()).toBe(true)
  expect(read().apiKey).toBe('')

  // The live translation form keeps its keys the same way.
  const kept = await json(
    apiA.put('/api/live-translation/settings', {
      data: JSON.parse(translation),
    }),
  )
  expect(kept.settings).toMatchObject({
    geminiApiKey: MASK,
    openaiApiKey: MASK,
  })
  const liveSettings = JSON.parse(
    storedValue(
      computerA.databasePath,
      "SELECT value FROM app_settings WHERE key = 'live_translation_settings'",
    ),
  ) as { geminiApiKey: string }
  expect(
    openSealed(
      computerA.databasePath,
      liveSettings.geminiApiKey,
      'app_settings.value:live_translation_settings.geminiApiKey',
    ),
  ).toBe(SECRETS.geminiKey)
})

test('a backup restored on the same computer opens its secrets', async () => {
  const backup = join(computerA.dataDir, 'e2e-backup.db')
  const exported = await apiA.post('/api/database/export', {
    data: { destinationPath: backup },
  })
  expect(exported.ok()).toBe(true)
  expect(plainSecretsIn(computerA.dataDir)).toEqual([])

  await apiA.put('/api/livestream/obs/config', {
    data: { password: 'changed-after-the-backup' },
  })
  const restored = await apiA.post('/api/database/import', {
    data: { sourcePath: backup },
  })
  expect((await restored.json()).data.success).toBe(true)

  const obs = await json(apiA.get('/api/livestream/obs/config'))
  expect(obs.data.password).toBe(SECRETS.obsPassword)
  const listener = await json(apiA.get('/api/live-translation/stream-secret'))
  expect(listener.secret).toBe(hostedRoomId(SECRETS.liveHostKey))
  const status = await json(apiA.get('/api/secret-store'))
  expect(status.data.resetFeatures).toEqual([])
})

test('a backup restored on another computer asks to set its features up again', async () => {
  const backup = join(computerA.dataDir, 'e2e-backup-for-b.db')
  expect(
    (
      await apiA.post('/api/database/export', {
        data: { destinationPath: backup },
      })
    ).ok(),
  ).toBe(true)

  computerB = new ExtraServer(601)
  await computerB.start()
  apiB = await computerB.adminRequest()
  const restored = await apiB.post('/api/database/import', {
    data: { sourcePath: backup },
  })
  expect((await restored.json()).data.success).toBe(true)
  // The restored admin's token was renewed: sign in again.
  await apiB.dispose()
  apiB = await computerB.adminRequest()

  const status = await json(apiB.get('/api/secret-store'))
  expect(status.data.resetFeatures).toEqual([
    'cloud-sync',
    'google-drive',
    'listener-link',
    'live-translation',
    'obs',
    'remote-access',
    'song-sources',
    'users',
    'youtube',
  ])

  const listener = await json(apiB.get('/api/live-translation/stream-secret'))
  expect(listener.secret).toMatch(/^h1[A-Za-z0-9_-]{43}$/)
  expect(listener.secret).not.toBe(hostedRoomId(SECRETS.liveHostKey))
  expect(listener.linkChanged).toBe(true)
  const pairing = await json(apiB.get('/api/remote-access'))
  expect(pairing.data.secret).not.toBe(hostedRoomId(SECRETS.remoteHostKey))

  const obs = await json(apiB.get('/api/livestream/obs/config'))
  expect(obs.data.password).toBe('')
  const youtube = await json(apiB.get('/api/livestream/youtube/status'))
  expect(youtube.data.isAuthenticated).toBe(false)
  const storage = await json(apiB.get('/api/song-sources/storage'))
  expect(storage.data).toMatchObject({ bucket: 'e2e-bucket', hasSecret: false })
  const translation = await json(apiB.get('/api/live-translation/settings'))
  expect(translation).toMatchObject({ geminiApiKey: '', openaiApiKey: '' })

  const counts = withDatabase(computerB.databasePath, (db) =>
    ['youtube_auth', 'google_drive_auth', 'cloud_sync'].map(
      (table) =>
        (
          db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
            n: number
          }
        ).n,
    ),
  )
  expect(counts).toEqual([0, 0, 0])
  const users = await json(apiB.get('/api/users'))
  const admin = (users.data as { isSuperAdmin: boolean; token: string }[]).find(
    (u) => u.isSuperAdmin,
  )
  expect(admin?.token).toMatch(/^usr_/)
  expect(admin?.token).not.toBe(SECRETS.adminToken)

  expect((await apiB.delete('/api/secret-store/reset-features')).ok()).toBe(
    true,
  )
  expect(
    (await json(apiB.get('/api/secret-store'))).data.resetFeatures,
  ).toEqual([])
})

test('a saved key is never sent to a new address without entering it again', async () => {
  const aiConfig = (overrides: Record<string, unknown>) =>
    apiA.post('/api/settings/app_settings', {
      data: {
        key: 'bible_ai_search_config',
        value: JSON.stringify({
          enabled: true,
          provider: 'custom',
          model: 'e2e-model',
          baseUrl: 'https://ai.church.example/v1',
          apiKey: MASK,
          ...overrides,
        }),
      },
    })
  const storedAiKey = () =>
    openSealed(
      computerA.databasePath,
      JSON.parse(
        storedValue(
          computerA.databasePath,
          "SELECT value FROM app_settings WHERE key = 'bible_ai_search_config'",
        ),
      ).apiKey,
      'app_settings.value:bible_ai_search_config.apiKey',
    )

  expect((await aiConfig({ apiKey: SECRETS.aiKey })).ok()).toBe(true)
  // The mask with the same address keeps the key.
  expect((await aiConfig({ model: 'e2e-model-2' })).ok()).toBe(true)
  expect(storedAiKey()).toBe(SECRETS.aiKey)
  // The mask with a new base URL or provider is refused.
  for (const change of [
    { baseUrl: 'https://keys.attacker.example/v1' },
    { provider: 'openai' },
  ]) {
    const refused = await aiConfig(change)
    expect(refused.status()).toBe(400)
    expect((await refused.json()).error).toMatch(/re-enter the key/i)
    expect(storedAiKey()).toBe(SECRETS.aiKey)
  }
  // A key entered with the new address is taken.
  expect(
    (
      await aiConfig({
        baseUrl: 'https://ai2.church.example/v1',
        apiKey: 'church-ai-key-for-the-new-address',
      })
    ).ok(),
  ).toBe(true)
  expect(storedAiKey()).toBe('church-ai-key-for-the-new-address')

  // S3: a blank secret keeps the saved one only for the same endpoint.
  const storage = (await json(apiA.get('/api/song-sources/storage'))).data
  const putStorage = (input: Record<string, unknown>) =>
    apiA.put('/api/song-sources/storage', { data: { ...storage, ...input } })
  expect((await putStorage({ secretAccessKey: '' })).ok()).toBe(true)
  const movedBucket = await putStorage({
    endpoint: 'https://s3.attacker.example',
    secretAccessKey: '',
  })
  expect(movedBucket.status()).toBe(400)
  expect((await movedBucket.json()).error).toMatch(/re-enter the key/i)
  expect(
    (
      await putStorage({
        endpoint: 'https://s3.church.example',
        secretAccessKey: 'church-s3-secret-for-the-new-endpoint',
      })
    ).ok(),
  ).toBe(true)

  // OBS: a new host keeps no saved password.
  const obs = (await json(apiA.get('/api/livestream/obs/config'))).data
  const movedObs = await apiA.put('/api/livestream/obs/config', {
    data: { host: 'obs.attacker.example', port: obs.port },
  })
  expect(movedObs.status()).toBe(400)
  expect(
    (
      await apiA.put('/api/livestream/obs/config', {
        data: { host: 'obs.church.example', password: 'church-obs-password-2' },
      })
    ).ok(),
  ).toBe(true)
  expect(plainSecretsIn(computerA.dataDir)).toEqual([])
})
