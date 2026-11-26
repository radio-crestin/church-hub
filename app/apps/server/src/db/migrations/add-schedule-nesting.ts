import type { Database } from 'bun:sqlite'

function hasColumn(db: Database, table: string, column: string): boolean {
  return db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all()
    .some((col) => col.name === column)
}

/**
 * Presentations inside presentations, and the control room's queue:
 * - `schedule_items.child_schedule_id`: a `schedule` item plays that
 *   presentation's items in its place (gone with it when it is deleted);
 * - `schedules.is_queue`: the one presentation the control room adds to when
 *   nothing else runs, hidden from the presentations list.
 * Idempotent: safe on every boot.
 */
export function addScheduleNesting(db: Database): void {
  if (!hasColumn(db, 'schedule_items', 'child_schedule_id')) {
    // biome-ignore lint/suspicious/noConsole: migration logging
    console.log('[add-schedule-nesting:info] Adding "child_schedule_id"')
    db.run(
      'ALTER TABLE schedule_items ADD COLUMN child_schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE',
    )
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_schedule_items_child_schedule_id ON schedule_items(child_schedule_id)',
    )
  }
  if (!hasColumn(db, 'schedules', 'is_queue')) {
    // biome-ignore lint/suspicious/noConsole: migration logging
    console.log('[add-schedule-nesting:info] Adding "is_queue"')
    db.run(
      'ALTER TABLE schedules ADD COLUMN is_queue INTEGER NOT NULL DEFAULT 0',
    )
  }
}
