import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-schedule-automation:${level}] ${message}`)
}

// v2 adds the per-slide timing (autoplay_by_text, advance_seconds).
const MIGRATION_KEY = 'add_schedule_automation_v2'

const COLUMNS: {
  table: 'schedules' | 'schedule_items'
  name: string
  definition: string
}[] = [
  // Seconds each slide stays up while the presentation runs; NULL = manual.
  { table: 'schedules', name: 'autoplay_seconds', definition: 'INTEGER' },
  // A slide with more text stays up longer than autoplay_seconds.
  {
    table: 'schedules',
    name: 'autoplay_by_text',
    definition: 'INTEGER NOT NULL DEFAULT 1',
  },
  // Past the last step, go back to the first instead of ending.
  {
    table: 'schedules',
    name: 'loop',
    definition: 'INTEGER NOT NULL DEFAULT 0',
  },
  // Music player volume (0-100) set when it starts; NULL = leave as it is.
  { table: 'schedules', name: 'music_volume', definition: 'INTEGER' },
  // Started by itself once the server is ready (one presentation at most).
  {
    table: 'schedules',
    name: 'start_on_app_start',
    definition: 'INTEGER NOT NULL DEFAULT 0',
  },
  // Seconds each slide of this item stays up; NULL = the presentation's.
  { table: 'schedule_items', name: 'advance_seconds', definition: 'INTEGER' },
]

/**
 * Adds the automation settings of a presentation (in `schedules`) and each
 * item's own slide timing (in `schedule_items`).
 * Idempotent — safe to run on every boot.
 */
export function addScheduleAutomation(db: Database): void {
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Migration already applied, skipping')
    return
  }

  for (const column of COLUMNS) {
    const existing = db
      .query<{ name: string }, []>(`PRAGMA table_info(${column.table})`)
      .all()
    if (existing.some((col) => col.name === column.name)) continue
    log('info', `Adding "${column.name}" column to ${column.table}...`)
    db.run(
      `ALTER TABLE ${column.table} ADD COLUMN ${column.name} ${column.definition}`,
    )
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
