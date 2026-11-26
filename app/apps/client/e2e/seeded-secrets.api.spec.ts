import { scryptSync } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import { redactSecrets } from '../../server/src/db/fixtures/redact-secrets'
import { SECRET_VALUE } from '../../server/src/db/fixtures/secret-patterns'

// Compiled into the app and seeded into every install: a secret in one ships to every user.
const FIXTURES_DIR = fileURLToPath(
  new URL('../../server/src/db/fixtures', import.meta.url),
)

/**
 * A fresh install must not start with a secret from the repo:
 * no AI provider key, and its own random live-translation stream secret.
 */
// Same fingerprint as server migrations/remove-seeded-secrets.ts
const OLD_SEEDED_STREAM_FINGERPRINT =
  '6f9702d11a0bf68e7818162bef13ac62e5aebc662c02d578b7440c25f32dead2'

const fingerprint = (value: string) =>
  scryptSync(value, 'church-hub-seeded-secret-v1', 32).toString('hex')

test.describe('Seeded secrets', () => {
  test('the stream secret is made by this install', async ({ request }) => {
    const response = await request.get('/api/live-translation/stream-secret')
    expect(response.status()).toBe(200)

    const { secret } = await response.json()
    expect(secret).toMatch(/^[a-z0-9]{32}$/)
    expect(fingerprint(secret)).not.toBe(OLD_SEEDED_STREAM_FINGERPRINT)
  })

  test('no seeded setting holds an API key', async ({ request }) => {
    const response = await request.get('/api/settings/app_settings')
    expect(response.status()).toBe(200)

    const { data } = await response.json()
    const settings = data as { key: string; value: string }[]
    const aiConfigs = settings.filter((s) => s.key.endsWith('ai_search_config'))

    expect(aiConfigs.length).toBeGreaterThan(0)
    for (const { key, value } of aiConfigs) {
      expect({ key, apiKey: JSON.parse(value).apiKey ?? null }).toEqual({
        key,
        apiKey: null,
      })
    }
  })

  test('no seeded setting holds a key-shaped value or a secret-named field', async ({
    request,
  }) => {
    const response = await request.get('/api/settings/app_settings')
    const { data } = await response.json()
    for (const { key, value } of data as { key: string; value: string }[]) {
      expect({ key, keyShaped: SECRET_VALUE.test(value) }).toEqual({
        key,
        keyShaped: false,
      })
      let parsed: unknown = value
      try {
        parsed = JSON.parse(value)
      } catch {
        // A plain string setting: the key-shape check above covers it.
      }
      expect({ key, value: redactSecrets(parsed) }).toEqual({
        key,
        value: parsed,
      })
    }
  })

  test('the shipped fixtures hold no secret', () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const text = readFileSync(join(FIXTURES_DIR, file), 'utf8')
      expect({
        file,
        key: text.match(SECRET_VALUE)?.[0].slice(0, 6) ?? null,
      }).toEqual({
        file,
        key: null,
      })
      const fixture = JSON.parse(text)
      expect(redactSecrets(fixture), file).toEqual(fixture)
    }
  })
})
