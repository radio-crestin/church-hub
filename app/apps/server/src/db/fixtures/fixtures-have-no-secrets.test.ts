import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { redactSecrets } from './redact-secrets'
import { sanitizeSettingValue } from './sanitize-setting-value'
import { SECRET_VALUE } from './secret-patterns'
import { describe, expect, test } from 'bun:test'

/**
 * Fixtures are compiled into the app and seeded into every install, so a
 * secret in one ships to every user.
 */
const FIXTURES_DIR = import.meta.dir
const fixtureFiles = readdirSync(FIXTURES_DIR).filter((file) =>
  file.endsWith('.json'),
)

describe('fixtures ship no secrets', () => {
  test.each(fixtureFiles)('%s holds no key-shaped value', (file) => {
    const text = readFileSync(join(FIXTURES_DIR, file), 'utf8')
    expect(text.match(SECRET_VALUE)?.[0].slice(0, 6) ?? null).toBeNull()
  })

  test.each(
    fixtureFiles,
  )('%s has no secret-named field with a value', (file) => {
    const fixture = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8'))
    expect(redactSecrets(fixture)).toEqual(fixture)
  })

  test('every default setting is allow-listed and sanitized', () => {
    const settings: { key: string; value: string }[] = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'default-settings.json'), 'utf8'),
    )

    for (const { key, value } of settings) {
      expect({ key, value: sanitizeSettingValue(key, value) }).toEqual({
        key,
        value,
      })
    }
  })
})
