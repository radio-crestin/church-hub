import type { Database } from 'bun:sqlite'
import {
  formatStyledMarkdown,
  type MarkdownStyleRange,
} from '../../service/bookmark-markdown'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[convert-bible-bookmark-styles-to-markdown:${level}] ${message}`)
}

const MIGRATION_KEY = 'convert_bible_bookmark_styles_to_markdown_v1'

/**
 * Stores every Bible bookmark as standard Markdown instead of a JSON list of
 * character ranges:
 * - adds `markdown` and fills it from `text` + `style_ranges`, so every
 *   highlight, bold and underline saved so far survives;
 * - drops `style_ranges`, which nothing reads any more.
 *
 * Runs in one transaction. Idempotent — safe to run on every boot.
 */
export function convertBibleBookmarkStylesToMarkdown(db: Database): void {
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Migration already applied, skipping')
    return
  }

  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(bible_bookmarks)')
    .all()
    .map((column) => column.name)

  db.transaction(() => {
    if (!columns.includes('markdown')) {
      db.run('ALTER TABLE bible_bookmarks ADD COLUMN markdown TEXT')
    }

    const hasStyleRanges = columns.includes('style_ranges')
    const rows = db
      .query<{ id: number; text: string; style_ranges: string | null }, []>(
        hasStyleRanges
          ? 'SELECT id, text, style_ranges FROM bible_bookmarks WHERE markdown IS NULL'
          : 'SELECT id, text, NULL AS style_ranges FROM bible_bookmarks WHERE markdown IS NULL',
      )
      .all()

    const update = db.prepare(
      'UPDATE bible_bookmarks SET markdown = ? WHERE id = ?',
    )
    for (const row of rows) {
      update.run(
        formatStyledMarkdown(row.text, readRanges(row.style_ranges)),
        row.id,
      )
    }
    log('info', `Converted ${rows.length} Bible bookmarks to Markdown`)

    if (hasStyleRanges) {
      db.run('ALTER TABLE bible_bookmarks DROP COLUMN style_ranges')
    }

    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [MIGRATION_KEY, JSON.stringify({ success: true })],
    )
  })()
}

/** Bad JSON means no styling, as it read before. */
function readRanges(json: string | null): MarkdownStyleRange[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    log('warning', 'Unreadable style_ranges, keeping the verse unstyled')
    return []
  }
}
