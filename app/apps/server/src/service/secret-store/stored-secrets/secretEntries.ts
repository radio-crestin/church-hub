import {
  SECRET_COLUMNS,
  SETTING_FEATURES,
  type SecretFeature,
} from './secretColumns'
import type { Database } from 'bun:sqlite'
import type { SecretPlace } from '../secretPlace'
import { secretPlaces } from '../secretPlaces'
import {
  parseSettingObject,
  SECRET_SETTING_FIELDS,
  settingPlace,
} from '../secretSettingFields'

/** One stored secret, with how to replace it or forget it. */
export interface SecretEntry {
  place: SecretPlace
  stored: string
  feature: SecretFeature | null
  replace: (value: string) => void
  /** Only when the value can't be opened: back to "not set up". */
  forget: () => void
}

interface ColumnRow {
  id: number
  value: unknown
  rowKey?: string | null
}

const hasColumn = (db: Database, table: string, column: string) =>
  db
    .query('SELECT 1 FROM pragma_table_info(?) WHERE name = ?')
    .get(table, column) !== null

function* columnEntries(db: Database): Generator<SecretEntry> {
  for (const slot of SECRET_COLUMNS) {
    if (!hasColumn(db, slot.table, slot.column)) continue
    const rowKey = slot.rowKey ? `, ${slot.rowKey} AS rowKey` : ''
    const rows = db
      .query<ColumnRow, []>(
        `SELECT rowid AS id, ${slot.column} AS value${rowKey} FROM ${slot.table}`,
      )
      .all()
    for (const { id, value, rowKey: key } of rows) {
      if (typeof value !== 'string' || value === '') continue
      const row = key ?? undefined
      yield {
        place: secretPlaces.column(slot.table, slot.column, row),
        stored: value,
        feature: slot.feature(row),
        replace: (next) =>
          db.run(
            `UPDATE ${slot.table} SET ${slot.column} = ? WHERE rowid = ?`,
            [next, id],
          ),
        forget: () => slot.forget(db, id, row),
      }
    }
  }
}

function* settingEntries(db: Database): Generator<SecretEntry> {
  if (!hasColumn(db, 'app_settings', 'value')) return
  for (const [key, fields] of Object.entries(SECRET_SETTING_FIELDS)) {
    const row = db
      .query<{ value: string }, [string]>(
        'SELECT value FROM app_settings WHERE key = ?',
      )
      .get(key)
    const value = row && parseSettingObject(row.value)
    if (!value) continue
    const write = (field: string, next: string) => {
      value[field] = next
      db.run(
        'UPDATE app_settings SET value = ?, updated_at = unixepoch() WHERE key = ?',
        [JSON.stringify(value), key],
      )
    }
    for (const field of fields) {
      const stored = value[field]
      if (typeof stored !== 'string' || stored === '') continue
      yield {
        place: settingPlace(key, field),
        stored,
        feature: SETTING_FEATURES[key] ?? null,
        replace: (next) => write(field, next),
        forget: () => write(field, ''),
      }
    }
  }
}

/** Every secret stored in `db`: the columns, then the settings fields. */
export function* secretEntries(db: Database): Generator<SecretEntry> {
  yield* columnEntries(db)
  yield* settingEntries(db)
}
