import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Database } from 'bun:sqlite'
import { syncFolder } from '../../service/music/syncFolder'
import { getResourcesDir } from '../../utils/paths'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-music:${level}] ${message}`)
}

const SAMPLE_FOLDER_NAME = 'Sample Hymns'

/**
 * The bundled sample hymns (public domain, see LICENSES.txt next to them):
 * the app's resources when packaged, app/tauri/resources/sample-music in
 * development (this file is app/apps/server/src/db/migrations/seed-music.ts).
 */
function getSampleMusicDir(): string | null {
  const resourcesDir = getResourcesDir()
  const dir = resourcesDir
    ? join(resourcesDir, 'sample-music')
    : join(import.meta.dir, '../../../../../tauri/resources/sample-music')
  return existsSync(dir) ? dir : null
}

/**
 * A fresh install's music library starts with the bundled sample hymns. An
 * install that already has that folder gets it rescanned, so a release that
 * changes the bundled hymns replaces the old ones in the library too. Users
 * who have their own folders and never had the sample one get nothing added.
 */
export function seedSampleMusic(db: Database): void {
  const musicDir = getSampleMusicDir()
  if (!musicDir) {
    log('warning', 'Sample music directory not found, skipping seed')
    return
  }

  const folderId = getOrCreateSampleFolder(db, musicDir)
  if (folderId === null) return

  // Reading the audio tags is async; the library fills in moments after start.
  void syncFolder(folderId).then((result) => {
    if (!result.success) {
      log(
        'error',
        `Scanning the sample hymns failed: ${result.errors.join('; ')}`,
      )
    }
  })
}

function getOrCreateSampleFolder(
  db: Database,
  musicDir: string,
): number | null {
  const existing = db
    .query<{ id: number }, [string]>(
      'SELECT id FROM music_folders WHERE path = ?',
    )
    .get(musicDir)
  if (existing) return existing.id

  const folderCount =
    db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM music_folders',
      )
      .get()?.count ?? 0
  if (folderCount > 0) {
    log('debug', 'The user has their own music folders, skipping sample hymns')
    return null
  }

  log('info', `Adding the sample hymns from: ${musicDir}`)
  return db
    .query<{ id: number }, [string, string]>(
      `INSERT INTO music_folders (path, name, is_recursive, file_count, created_at, updated_at)
       VALUES (?, ?, 0, 0, unixepoch(), unixepoch()) RETURNING id`,
    )
    .get(musicDir, SAMPLE_FOLDER_NAME)!.id
}
