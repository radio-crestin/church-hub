import type { Database } from 'bun:sqlite'

/**
 * Runs `work` on a backup copy with the triggers of `tables` removed and
 * foreign keys off, then puts the triggers back as they were. Taking
 * resources out of a copy, or putting them back at restore, must not touch
 * anything else: the sync triggers on song_slides would mark songs as
 * changed, and deleting verses would cascade into the church's programs.
 */
export function withoutTriggers(
  db: Database,
  tables: string[],
  work: () => void,
) {
  const marks = tables.map(() => '?').join(',')
  const triggers = db
    .query(
      `SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name IN (${marks})`,
    )
    .all(...tables) as { name: string; sql: string }[]
  db.run('PRAGMA foreign_keys = OFF')
  for (const { name } of triggers)
    db.run(`DROP TRIGGER "${name.replace(/"/g, '""')}"`)
  try {
    db.transaction(work)()
  } finally {
    for (const { sql } of triggers) db.run(sql)
  }
}
