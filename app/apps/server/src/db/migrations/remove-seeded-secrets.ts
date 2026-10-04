import { scryptSync } from 'node:crypto'

import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[remove-seeded-secrets:${level}] ${message}`)
}

/** Fingerprints of values that older default settings seeded into installs. */
const SEEDED_SECRET_FINGERPRINTS = new Set([
  'ffb5e3fd95a88bba71d04ad3845949d5d0df86b777f6f8ed254483c10416638e',
  'da38bcc32ae044835abbb657814d0de4ad6e1368903a6435dd875e255a8b51dd',
  '6f9702d11a0bf68e7818162bef13ac62e5aebc662c02d578b7440c25f32dead2',
])

const FINGERPRINT_SALT = 'church-hub-seeded-secret-v1'

/**
 * scrypt, not a fast hash: the values are credentials, so their fingerprint
 * must be slow to brute-force (~15 ms each, at most four per start).
 */
export function fingerprintSecret(secret: string): string {
  return scryptSync(secret, FINGERPRINT_SALT, 32).toString('hex')
}

const AI_CONFIG_KEYS = [
  'ai_search_config',
  'bible_ai_search_config',
  'songs_ai_search_config',
]

const STREAM_SECRET_KEY = 'live_translation_stream_secret'

function isSeeded(secret: unknown, seeded: Set<string>): boolean {
  if (typeof secret !== 'string' || secret === '') return false
  return seeded.has(fingerprintSecret(secret))
}

function readSetting(db: Database, key: string): string | null {
  return (
    db
      .query<{ value: string }, [string]>(
        'SELECT value FROM app_settings WHERE key = ?',
      )
      .get(key)?.value ?? null
  )
}

/** A setting that is not valid JSON holds no seeded key; it must not stop startup. */
function parseConfig(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value)
  } catch {
    log('warning', 'Skipping an AI search config that is not valid JSON')
    return null
  }
}

function clearSeededApiKey(
  db: Database,
  key: string,
  seeded: Set<string>,
): void {
  const value = readSetting(db, key)
  if (value === null) return

  const config = parseConfig(value)
  if (!isSeeded(config?.apiKey, seeded)) return

  db.run(
    'UPDATE app_settings SET value = ?, updated_at = unixepoch() WHERE key = ?',
    [JSON.stringify({ ...config, apiKey: null }), key],
  )
  log('info', `Cleared a seeded API key from ${key}`)
}

function removeSeededStreamSecret(db: Database, seeded: Set<string>): void {
  if (!isSeeded(readSetting(db, STREAM_SECRET_KEY), seeded)) return

  // The stream service makes a fresh random secret the next time it is read.
  db.run('DELETE FROM app_settings WHERE key = ?', [STREAM_SECRET_KEY])
  log('info', 'Removed a seeded live-translation stream secret')
}

/**
 * Removes secrets that older default settings seeded into installs. Runs on
 * each start; it only touches a setting whose value matches a fingerprint, so
 * a key or secret the user set stays as is.
 */
export function removeSeededSecrets(
  db: Database,
  seeded: Set<string> = SEEDED_SECRET_FINGERPRINTS,
): void {
  for (const key of AI_CONFIG_KEYS) clearSeededApiKey(db, key, seeded)
  removeSeededStreamSecret(db, seeded)
  log('debug', 'Seeded secrets check done')
}
