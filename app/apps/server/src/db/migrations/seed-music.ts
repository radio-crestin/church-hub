import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { Database } from 'bun:sqlite'
import { getResourcesDir } from '../../utils/paths'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-music:${level}] ${message}`)
}

/**
 * Gets the path to the bundled sample music folder.
 * In production: bundled in Tauri resources
 * In development: relative to the tauri resources directory
 */
function getSampleMusicDir(): string | null {
  const resourcesDir = getResourcesDir()
  if (resourcesDir) {
    const dir = join(resourcesDir, 'sample-music')
    return existsSync(dir) ? dir : null
  }

  // Development: resolve relative to this file
  // This file is at: apps/server/src/db/migrations/seed-music.ts
  // Resources are at: tauri/resources/sample-music
  const devDir = join(
    import.meta.dir,
    '..',
    '..',
    '..',
    '..',
    'tauri',
    'resources',
    'sample-music',
  )
  return existsSync(devDir) ? devDir : null
}

/**
 * Seeds a default music folder with the bundled sample audio file.
 * Uses INSERT OR IGNORE to avoid duplicating the folder on subsequent runs.
 * Only seeds if the sample music directory exists.
 */
export function seedSampleMusic(db: Database): void {
  const musicDir = getSampleMusicDir()
  if (!musicDir) {
    log('debug', 'Sample music directory not found, skipping seed')
    return
  }

  // Check if any music folder already exists (user may have configured their own)
  const existingFolders = db
    .query<{ count: number }, []>('SELECT COUNT(*) as count FROM music_folders')
    .get()

  if (existingFolders && existingFolders.count > 0) {
    log('debug', 'Music folders already exist, skipping sample music seed')
    return
  }

  const sampleFile = join(musicDir, 'sample.mp3')
  if (!existsSync(sampleFile)) {
    log('warning', 'Sample music file not found: sample.mp3')
    return
  }

  log('info', `Seeding sample music from: ${musicDir}`)

  const now = Math.floor(Date.now() / 1000)

  // Insert the sample music folder
  db.run(
    `INSERT OR IGNORE INTO music_folders (path, name, is_recursive, file_count, last_sync_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [musicDir, 'Sample Music', 0, 1, now, now, now],
  )

  // Get the folder ID
  const folder = db
    .query<{ id: number }, [string]>(
      'SELECT id FROM music_folders WHERE path = ?',
    )
    .get(musicDir)

  if (!folder) {
    log('warning', 'Failed to get sample music folder ID')
    return
  }

  // Get file stats for the sample
  const stats = statSync(sampleFile)

  // Insert the sample music file
  db.run(
    `INSERT OR IGNORE INTO music_files (folder_id, path, filename, title, artist, album, duration, format, file_size, last_modified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      folder.id,
      sampleFile,
      'sample.mp3',
      'Sample Audio',
      'Church Hub',
      'Default Music',
      3.0,
      'mp3',
      stats.size,
      Math.floor(stats.mtimeMs / 1000),
      now,
      now,
    ],
  )

  log('info', 'Sample music seeded successfully')
}
