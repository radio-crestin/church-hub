import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-youtube-broadcast-settings:${level}] ${message}`)
}

/**
 * The YouTube broadcast settings the operator sets on the YouTube settings
 * page, each sent when a broadcast is created. DVR starts off, auto-start and
 * auto-stop on (what every broadcast had until now), and the songs and verses
 * shown written into the description as chapters, on.
 *
 * Idempotent: adds only the columns a database lacks.
 */
const COLUMNS: [name: string, definition: string][] = [
  ['category_id', 'TEXT'],
  ['tags', "TEXT NOT NULL DEFAULT '[]'"],
  ['made_for_kids', 'INTEGER NOT NULL DEFAULT 0'],
  ['latency_preference', "TEXT NOT NULL DEFAULT 'normal'"],
  ['enable_dvr', 'INTEGER NOT NULL DEFAULT 0'],
  ['enable_auto_start', 'INTEGER NOT NULL DEFAULT 1'],
  ['enable_auto_stop', 'INTEGER NOT NULL DEFAULT 1'],
  ['thumbnail_url', 'TEXT'],
  ['description_chapters', 'INTEGER NOT NULL DEFAULT 1'],
]

export function addYouTubeBroadcastSettings(db: Database): void {
  const existing = new Set(
    db
      .query<{ name: string }, []>('PRAGMA table_info(youtube_config)')
      .all()
      .map((col) => col.name),
  )
  for (const [name, definition] of COLUMNS) {
    if (existing.has(name)) continue
    log('info', `Adding "${name}" to youtube_config`)
    db.run(`ALTER TABLE youtube_config ADD COLUMN ${name} ${definition}`)
  }
}
