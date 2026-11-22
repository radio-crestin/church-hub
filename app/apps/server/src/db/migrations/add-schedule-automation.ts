import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-schedule-automation:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_schedule_automation_v1'

const COLUMNS: { name: string; definition: string }[] = [
  // Seconds each step stays up while the presentation runs; NULL = manual.
  { name: 'autoplay_seconds', definition: 'INTEGER' },
  // Past the last step, go back to the first instead of ending.
  { name: 'loop', definition: 'INTEGER NOT NULL DEFAULT 0' },
  // Music player volume (0-100) set when it starts; NULL = leave as it is.
  { name: 'music_volume', definition: 'INTEGER' },
  // Started by itself once the server is ready (one presentation at most).
  { name: 'start_on_app_start', definition: 'INTEGER NOT NULL DEFAULT 0' },
]

/**
 * Adds the automation settings of a presentation (stored in `schedules`).
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

  const existing = new Set(
    db
      .query<{ name: string }, []>('PRAGMA table_info(schedules)')
      .all()
      .map((col) => col.name),
  )

  for (const column of COLUMNS) {
    if (existing.has(column.name)) continue
    log('info', `Adding "${column.name}" column to schedules...`)
    db.run(
      `ALTER TABLE schedules ADD COLUMN ${column.name} ${column.definition}`,
    )
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
