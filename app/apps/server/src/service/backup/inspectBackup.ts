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

export interface BackupContents {
  counts: BackupCounts
  /** First `MAX_LISTED_ITEMS` songs (alphabetical), with category when set. */
  songs: { title: string; category: string | null }[]
  schedules: { title: string; createdAtMs: number | null }[]
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

function readBackupContents(db: Database): BackupContents {
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

  const schedules = tableExists('schedules')
    ? db
        .query<{ title: string; createdAt: number | null }, []>(
          `SELECT title, created_at AS createdAt FROM schedules ORDER BY created_at DESC LIMIT ${MAX_LISTED_ITEMS}`,
        )
        .all()
        .map((row) => ({
          title: row.title,
          createdAtMs: row.createdAt ? row.createdAt * 1000 : null,
        }))
    : []

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
