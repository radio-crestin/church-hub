import type { Database } from 'bun:sqlite'
import { batchUpdateSearchIndex } from '../../service/songs/search'
import { stripFormattingTags } from '../../service/songs/text/stripFormattingTags'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[strip-song-formatting:${level}] ${message}`)
}

const MIGRATION_KEY = 'strip_song_formatting_tags_v1'
const SEARCH_INDEX_BATCH = 500

const SONG_TEXT_COLUMNS = [
  'title',
  'author',
  'copyright',
  'theme',
  'alt_theme',
  'hymn_number',
  'key_line',
] as const
const SLIDE_TEXT_COLUMNS = ['content', 'label', 'notes'] as const

type Row = { id: number } & Record<string, string | number | null>

/** A one-line field: tags out, the spaces they leave behind folded. */
function cleanLine(value: string): string {
  const cleaned = stripFormattingTags(value)
  if (cleaned === value) return value
  return cleaned.replace(/\s{2,}/g, ' ').trim()
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    log('warning', `Left unreadable alternate titles as they are: ${json}`)
    return null
  }
}

function cleanAlternateTitles(json: string): string {
  const titles = parseJson(json)
  if (!Array.isArray(titles)) return json
  const cleaned = titles
    .map((title) => (typeof title === 'string' ? cleanLine(title) : title))
    .filter((title) => title !== '')
  return JSON.stringify([...new Set(cleaned)])
}

/** Rewrites the given columns of every row in `table`; returns the changed rows. */
function cleanTable(
  db: Database,
  table: string,
  columns: readonly string[],
  clean: (column: string, value: string) => string,
): Row[] {
  const extra = table === 'song_slides' ? ', song_id' : ''
  const rows = db
    .query<Row, []>(`SELECT id${extra}, ${columns.join(', ')} FROM ${table}`)
    .all()
  const changed: Row[] = []
  for (const row of rows) {
    const updates: Record<string, string> = {}
    for (const column of columns) {
      const value = row[column]
      if (typeof value !== 'string') continue
      const cleaned = clean(column, value)
      // Never blank a required field: a title made only of tags stays as is.
      if (cleaned !== value && cleaned !== '') updates[column] = cleaned
    }
    const names = Object.keys(updates)
    if (names.length === 0) continue
    db.run(
      `UPDATE ${table} SET ${names.map((n) => `${n} = ?`).join(', ')}, updated_at = unixepoch() WHERE id = ?`,
      [...names.map((n) => updates[n]), row.id],
    )
    changed.push(row)
  }
  return changed
}

/**
 * Removes inline formatting tags (<i>, <b>, <span …>, also stored as escaped
 * text like &lt;i&gt;) from every song's title, metadata and slides, and from
 * song version-group titles. The text inside the tags stays.
 *
 * Runs after add_sync on purpose: each cleaned song is queued for the library
 * sync with a fresh updated_at, so the cloud copy and other devices get the
 * clean text too (last writer wins). Songs it did not change are not touched.
 */
export function stripSongFormattingTags(db: Database): void {
  const applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count
  if (applied && applied > 0) {
    log('debug', 'Already applied, skipping')
    return
  }

  db.run('BEGIN TRANSACTION')
  let songIds: number[]
  let groupCount: number
  try {
    const songs = cleanTable(
      db,
      'songs',
      [...SONG_TEXT_COLUMNS, 'alternate_titles'],
      (column, value) =>
        column === 'alternate_titles'
          ? cleanAlternateTitles(value)
          : cleanLine(value),
    )
    const slides = cleanTable(db, 'song_slides', SLIDE_TEXT_COLUMNS, (_, v) =>
      stripFormattingTags(v),
    )
    groupCount = cleanTable(db, 'song_groups', ['canonical_title'], (_, v) =>
      cleanLine(v),
    ).length
    songIds = [
      ...new Set([
        ...songs.map((row) => row.id),
        ...slides.map((row) => row.song_id as number),
      ]),
    ]
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    log('error', `Failed: ${error}`)
    throw error
  }

  for (let i = 0; i < songIds.length; i += SEARCH_INDEX_BATCH) {
    batchUpdateSearchIndex(songIds.slice(i, i + SEARCH_INDEX_BATCH))
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [
      MIGRATION_KEY,
      JSON.stringify({
        songsCleaned: songIds.length,
        groupsCleaned: groupCount,
      }),
    ],
  )
  log(
    'info',
    `Cleaned formatting tags from ${songIds.length} song(s), ${groupCount} group(s)`,
  )
}
