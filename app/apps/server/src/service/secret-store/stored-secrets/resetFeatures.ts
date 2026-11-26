import type { SecretFeature } from './secretColumns'
import type { Database } from 'bun:sqlite'
import { getRawDatabase } from '../../../db'

/**
 * The features a restore from another computer left to set up again, until
 * the user dismisses the notice. Kept in app_settings: it holds no secret.
 */
const KEY = 'secret_store_reset_features'

function readFrom(db: Database): SecretFeature[] {
  const row = db
    .query<{ value: string }, [string]>(
      'SELECT value FROM app_settings WHERE key = ?',
    )
    .get(KEY)
  if (!row) return []
  const parsed: unknown = JSON.parse(row.value)
  return Array.isArray(parsed) ? (parsed as SecretFeature[]) : []
}

export function recordResetFeatures(
  db: Database,
  features: Set<SecretFeature>,
): void {
  const all = [...new Set([...readFrom(db), ...features])].sort()
  db.run(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    [KEY, JSON.stringify(all)],
  )
}

export const getResetFeatures = () => readFrom(getRawDatabase())

export const dismissResetFeatures = () =>
  getRawDatabase().run('DELETE FROM app_settings WHERE key = ?', [KEY])
