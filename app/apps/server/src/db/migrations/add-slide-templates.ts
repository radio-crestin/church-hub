import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-slide-templates:${level}] ${message}`)
}

const COLUMNS: { table: string; name: string; definition: string }[] = [
  // The template the screen draws with.
  { table: 'screens', name: 'template_id', definition: 'INTEGER' },
  // A running presentation restyles this screen (projector and kiosk).
  {
    table: 'screens',
    name: 'follows_presentation',
    definition: 'INTEGER NOT NULL DEFAULT 0',
  },
  // A presentation's template, for all its slides; NULL = each screen's own.
  { table: 'schedules', name: 'template_id', definition: 'INTEGER' },
  // One item's own template; NULL = the presentation's.
  { table: 'schedule_items', name: 'template_id', definition: 'INTEGER' },
]

/**
 * Slide templates (CH-184): the table, the OBS scene → template mapping and
 * the columns pointing to a template. Runs before seed-screens, which gives
 * new screens a template; move-screen-layouts-into-templates then turns the
 * layouts existing screens kept themselves into templates.
 * Idempotent: safe on every boot.
 */
export function addSlideTemplates(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS slide_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bundled_key TEXT,
    width INTEGER NOT NULL DEFAULT 1920,
    height INTEGER NOT NULL DEFAULT 1080,
    layouts TEXT NOT NULL DEFAULT '{}',
    global_settings TEXT NOT NULL DEFAULT '{}',
    next_slide TEXT NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`)
  db.run(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_slide_templates_bundled_key ON slide_templates (bundled_key)',
  )
  db.run(`CREATE TABLE IF NOT EXISTS screen_scene_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    obs_scene_name TEXT NOT NULL,
    template_id INTEGER NOT NULL REFERENCES slide_templates(id) ON DELETE CASCADE
  )`)
  db.run(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_screen_scene_templates_unique ON screen_scene_templates (screen_id, obs_scene_name)',
  )
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_screen_scene_templates_template_id ON screen_scene_templates (template_id)',
  )

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
}
