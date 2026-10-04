import { fingerprintSecret, removeSeededSecrets } from './remove-seeded-secrets'
import Database from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'

const SEEDED_KEY = 'fake-seeded-openai-key'
const SEEDED_STREAM_SECRET = 'fakeseededstreamsecret0000000000'
const SEEDED = new Set(
  [SEEDED_KEY, SEEDED_STREAM_SECRET].map(fingerprintSecret),
)

function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run(`
    CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  return db
}

function setSetting(db: Database, key: string, value: string): void {
  db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', [key, value])
}

function getSetting(db: Database, key: string): string | null {
  return (
    db
      .query<{ value: string }, [string]>(
        'SELECT value FROM app_settings WHERE key = ?',
      )
      .get(key)?.value ?? null
  )
}

function aiConfig(apiKey: string | null): string {
  return JSON.stringify({ enabled: true, provider: 'openai', apiKey })
}

describe('removeSeededSecrets', () => {
  test('clears a seeded API key and keeps the rest of the AI config', () => {
    const db = createTestDb()
    setSetting(db, 'songs_ai_search_config', aiConfig(SEEDED_KEY))

    removeSeededSecrets(db, SEEDED)

    expect(getSetting(db, 'songs_ai_search_config')).toBe(aiConfig(null))
  })

  test('keeps an API key the user set', () => {
    const db = createTestDb()
    setSetting(db, 'ai_search_config', aiConfig('users-own-key'))

    removeSeededSecrets(db, SEEDED)

    expect(getSetting(db, 'ai_search_config')).toBe(aiConfig('users-own-key'))
  })

  test('removes a seeded stream secret so a fresh one is made', () => {
    const db = createTestDb()
    setSetting(db, 'live_translation_stream_secret', SEEDED_STREAM_SECRET)

    removeSeededSecrets(db, SEEDED)

    expect(getSetting(db, 'live_translation_stream_secret')).toBeNull()
  })

  test('keeps a stream secret made by this install', () => {
    const db = createTestDb()
    setSetting(db, 'live_translation_stream_secret', 'own-random-secret')

    removeSeededSecrets(db, SEEDED)

    expect(getSetting(db, 'live_translation_stream_secret')).toBe(
      'own-random-secret',
    )
  })

  test('skips an AI config that is not valid JSON', () => {
    const db = createTestDb()
    setSetting(db, 'bible_ai_search_config', 'not json')

    expect(() => removeSeededSecrets(db, SEEDED)).not.toThrow()
    expect(getSetting(db, 'bible_ai_search_config')).toBe('not json')
  })
})
