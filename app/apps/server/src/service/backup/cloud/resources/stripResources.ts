import { loadLibrarySongs } from './loadLibrarySongs'
import type { ResourcePlan } from './planResources'
import { withoutTriggers } from './withoutTriggers'
import type { Database } from 'bun:sqlite'

/**
 * Empties a full-text index; restore rebuilds it from the restored rows.
 * The table is dropped and created again from its own SQL: deleting FTS5
 * rows only adds delete markers, so its pages would stay in the copy.
 */
function emptySearchIndex(db: Database, table: string) {
  const found = db
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { sql: string } | null
  if (!found) return
  db.run(`DROP TABLE "${table}"`)
  db.run(found.sql)
}

/**
 * Takes the plan's resources out of a backup copy, leaving the church's own
 * data: the library songs' slides and the Bible's books and verses (they
 * travel as blobs), and the derived search indexes. Triggers and foreign
 * keys stay out of it (withoutTriggers). Then the copy is compacted.
 */
export function stripResources(db: Database, plan: ResourcePlan) {
  loadLibrarySongs(db, plan)
  withoutTriggers(db, ['song_slides', 'bible_verses', 'bible_books'], () => {
    db.run(
      'DELETE FROM song_slides WHERE song_id IN (SELECT id FROM cloud_library_songs)',
    )
    const marks = plan.translationIds.map(() => '?').join(',')
    if (marks) {
      db.query(
        `DELETE FROM bible_verses WHERE translation_id IN (${marks})`,
      ).run(...plan.translationIds)
      db.query(
        `DELETE FROM bible_books WHERE translation_id IN (${marks})`,
      ).run(...plan.translationIds)
    }
    emptySearchIndex(db, 'songs_fts')
    emptySearchIndex(db, 'bible_verses_fts')
  })
  db.run('DROP TABLE IF EXISTS temp.cloud_library_songs')
  db.run('VACUUM')
}
