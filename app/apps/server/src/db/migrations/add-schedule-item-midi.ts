import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-schedule-item-midi:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_schedule_item_midi'

const COLUMNS: { name: string; definition: string }[] = [
  // Content hash of the MIDI file played with a song item (data/midi/).
  { name: 'midi_file', definition: 'TEXT' },
  { name: 'midi_file_name', definition: 'TEXT' },
  { name: 'midi_duration_seconds', definition: 'REAL' },
  // JSON array: the second each slide starts at; NULL = split evenly.
  { name: 'midi_verse_times', definition: 'TEXT' },
]

/**
 * Adds a song item's MIDI file, played while the presentation runs with the
 * slides following it (service/midi-audio).
 * Idempotent — safe to run on every boot.
 */
export function addScheduleItemMidi(db: Database): void {
  const applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count
  if (applied && applied > 0) {
    log('debug', 'Migration already applied, skipping')
    return
  }

  const existing = db
    .query<{ name: string }, []>('PRAGMA table_info(schedule_items)')
    .all()
  for (const column of COLUMNS) {
    if (existing.some((col) => col.name === column.name)) continue
    log('info', `Adding "${column.name}" column to schedule_items...`)
    db.run(
      `ALTER TABLE schedule_items ADD COLUMN ${column.name} ${column.definition}`,
    )
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
