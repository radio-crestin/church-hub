import { scryptSync } from 'node:crypto'
import { expect, test } from '@playwright/test'

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
})
