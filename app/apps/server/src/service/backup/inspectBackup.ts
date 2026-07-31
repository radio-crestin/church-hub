import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

import { downloadBackupToTemp } from './downloadBackupToTemp'
import { getDriveService, isInsufficientScopeError } from './getDriveService'
import { Database } from 'bun:sqlite'
import { createLogger } from '../../utils/logger'
import { getDataDir } from '../../utils/paths'

const logger = createLogger('backup')

/**
 * Cap for each listed collection (songs, schedules, playlists). Libraries can
 * hold tens of thousands of songs — listing them all would balloon the response
 * and choke the UI. Counts stay exact; the client shows "…and N more".
 */
const MAX_LISTED_ITEMS = 500

/**
 * Per-program song titles shown in the inspect view. Enough to recognise a
 * service at a glance without turning the payload into a second song list.
 */
const MAX_LISTED_SCHEDULE_SONGS = 25

export interface BackupCounts {
  songs: number
  songSlides: number
  songCategories: number
  songBookmarks: number
  schedules: number
  scheduleItems: number
  musicPlaylists: number
  musicFiles: number
  bibleTranslations: number
  users: number
  screens: number
}

export interface BackupSchedule {
  title: string
  createdAtMs: number | null
  /** Total items in the program (songs, passages, slides, scenes). */
  itemCount: number
  /** Song items only — what an operator recognises a program by. */
  songCount: number
  /** First `MAX_LISTED_SCHEDULE_SONGS` song titles, in program order. */
  songTitles: string[]
}

export interface BackupContents {
  counts: BackupCounts
  /** First `MAX_LISTED_ITEMS` songs (alphabetical), with category when set. */
  songs: { title: string; category: string | null }[]
  schedules: BackupSchedule[]
  playlists: { name: string; itemCount: number }[]
}

export interface InspectBackupResult {
  success: boolean
  contents?: BackupContents
  requiresReconnect?: boolean
  error?: string
}

/**
 * Downloads a backup from Drive and reads its contents (song titles, schedules,
 * playlists and per-table counts) from a temp copy — without touching the live
 * database. Tables absent from older backups count as 0.
 */
export async function inspectBackup(
  fileId: string,
): Promise<InspectBackupResult> {
  const drive = await getDriveService()
  if (!drive) {
    return { success: false, error: 'not_connected' }
  }

  const tempPath = join(getDataDir(), `.backup-inspect-${Date.now()}.db`)

  try {
    await downloadBackupToTemp(drive, fileId, tempPath)

    const header = await Bun.file(tempPath).slice(0, 16).text()
    if (!header.startsWith('SQLite format 3')) {
      return { success: false, error: 'invalid_backup' }
    }

    // Not opened readonly: backups keep WAL journal mode, and SQLite cannot
    // open a WAL database read-only (it must create the -shm/-wal files).
    // The temp file is ours and only SELECTs run against it.
    const db = new Database(tempPath)
    try {
      return { success: true, contents: readBackupContents(db) }
    } finally {
      db.close()
    }
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      return {
        success: false,
        requiresReconnect: true,
        error: 'insufficient_scope',
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Backup inspection failed: ${message}`)
    return { success: false, error: message }
  } finally {
    await unlink(tempPath).catch(() => {})
    await unlink(`${tempPath}-wal`).catch(() => {})
    await unlink(`${tempPath}-shm`).catch(() => {})
  }
}

/**
 * Reads each program with its item/song counts and the first song titles, so
 * the inspect view proves a program survived the backup with its songs — not
 * just that a row named "Duminica dimineata" exists. Item tables are absent
 * from very old backups, in which case the counts read 0 rather than throwing.
 */
function readSchedules(
  db: Database,
  tableExists: (name: string) => boolean,
): BackupSchedule[] {
  if (!tableExists('schedules')) return []

  const rows = db
    .query<{ id: number; title: string; createdAt: number | null }, []>(
      `SELECT id, title, created_at AS createdAt
         FROM schedules
        ORDER BY created_at DESC
        LIMIT ${MAX_LISTED_ITEMS}`,
    )
    .all()

  if (!tableExists('schedule_items')) {
    return rows.map((row) => ({
      title: row.title,
      createdAtMs: row.createdAt ? row.createdAt * 1000 : null,
      itemCount: 0,
      songCount: 0,
      songTitles: [],
    }))
  }

  const hasSongs = tableExists('songs')
  const countsQuery = db.query<
    { itemCount: number; songCount: number },
    [number]
  >(
    `SELECT COUNT(*) AS itemCount,
            SUM(CASE WHEN item_type = 'song' THEN 1 ELSE 0 END) AS songCount
       FROM schedule_items
      WHERE schedule_id = ?`,
  )
  const titlesQuery = hasSongs
    ? db.query<{ title: string }, [number]>(
        `SELECT s.title AS title
           FROM schedule_items i
           JOIN songs s ON s.id = i.song_id
          WHERE i.schedule_id = ? AND i.item_type = 'song'
          ORDER BY i.sort_order, i.id
          LIMIT ${MAX_LISTED_SCHEDULE_SONGS}`,
      )
    : null

  return rows.map((row) => {
    const counts = countsQuery.get(row.id)
    return {
      title: row.title,
      createdAtMs: row.createdAt ? row.createdAt * 1000 : null,
      itemCount: counts?.itemCount ?? 0,
      songCount: counts?.songCount ?? 0,
      songTitles: titlesQuery?.all(row.id).map((r) => r.title) ?? [],
    }
  })
}

/**
 * Reads a backup's contents from an already-open SQLite handle. Exported so the
 * round-trip test can assert against a real database without going through
 * Drive.
 */
export function readBackupContents(db: Database): BackupContents {
  const tableExists = (name: string): boolean =>
    !!db
      .query<{ name: string }, [string]>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(name)

  const count = (table: string): number =>
    tableExists(table)
      ? (db
          .query<{ c: number }, []>(`SELECT COUNT(*) AS c FROM "${table}"`)
          .get()?.c ?? 0)
      : 0

  const songs = tableExists('songs')
    ? db
        .query<{ title: string; category: string | null }, []>(
          tableExists('song_categories')
            ? `SELECT s.title AS title, c.name AS category
               FROM songs s
               LEFT JOIN song_categories c ON c.id = s.category_id
               ORDER BY s.title COLLATE NOCASE
               LIMIT ${MAX_LISTED_ITEMS}`
            : `SELECT title, NULL AS category FROM songs ORDER BY title COLLATE NOCASE LIMIT ${MAX_LISTED_ITEMS}`,
        )
        .all()
    : []

  const schedules = readSchedules(db, tableExists)

  const playlists = tableExists('music_playlists')
    ? db
        .query<{ name: string; itemCount: number }, []>(
          `SELECT name, item_count AS itemCount FROM music_playlists ORDER BY name COLLATE NOCASE LIMIT ${MAX_LISTED_ITEMS}`,
        )
        .all()
    : []

  return {
    counts: {
      songs: count('songs'),
      songSlides: count('song_slides'),
      songCategories: count('song_categories'),
      songBookmarks: count('song_bookmarks'),
      schedules: count('schedules'),
      scheduleItems: count('schedule_items'),
      musicPlaylists: count('music_playlists'),
      musicFiles: count('music_files'),
      bibleTranslations: count('bible_translations'),
      users: count('users'),
      screens: count('screens'),
    },
    songs,
    schedules,
    playlists,
  }
}
