import type { ResourcePlan } from './planResources'
import type { Database } from 'bun:sqlite'

/** The plan's library song ids in a temp table (`cloud_library_songs`) of this connection. */
export function loadLibrarySongs(db: Database, plan: ResourcePlan) {
  db.run(
    'CREATE TEMP TABLE IF NOT EXISTS cloud_library_songs (id INTEGER PRIMARY KEY)',
  )
  db.run('DELETE FROM cloud_library_songs')
  const insert = db.prepare('INSERT INTO cloud_library_songs (id) VALUES (?)')
  db.transaction(() => {
    for (const id of plan.songIds) insert.run(id)
  })()
}
