import type { Database } from 'bun:sqlite'

/**
 * The notifications history: what the app told the user (songs synced from
 * the song sources, an app update), kept 60 days. Idempotent.
 * `data` is the notification's details as JSON; the client words them.
 */
export function addNotifications(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      read_at INTEGER
    )
  `)
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)',
  )
}
