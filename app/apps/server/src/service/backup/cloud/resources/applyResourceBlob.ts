import { RESOURCE_TABLES } from './planResources'
import type { ResourceSection } from './resourceBlobFormat'
import type { Database } from 'bun:sqlite'

/**
 * Puts a verified resource blob's rows back into a restored copy. Only the
 * resource tables, and only columns those tables have, are written; the
 * caller runs it inside withoutTriggers.
 */
export function applyResourceBlob(db: Database, sections: ResourceSection[]) {
  for (const { table, columns, rows } of sections) {
    if (!RESOURCE_TABLES.includes(table)) throw new Error('backup_unreadable')
    const known = new Set(
      (
        db.query(`PRAGMA table_info("${table}")`).all() as { name: string }[]
      ).map((c) => c.name),
    )
    if (!columns.every((column) => known.has(column)))
      throw new Error('backup_unreadable')
    const insert = db.prepare(
      `INSERT OR REPLACE INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    )
    for (const row of rows) insert.run(...(row as never[]))
  }
}
