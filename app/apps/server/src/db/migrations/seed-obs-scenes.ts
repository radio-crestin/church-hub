import type { Database } from 'bun:sqlite'
import defaultObsScenes from '../fixtures/default-obs-scenes.json'

const DEBUG = process.env.DEBUG === 'true'
const SEED_KEY = 'seed_default_obs_scenes_v1'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-obs-scenes:${level}] ${message}`)
}

function hasRows(db: Database, table: string): boolean {
  const row = db.query(`SELECT COUNT(*) as count FROM ${table}`).get() as {
    count: number
  }
  return row.count > 0
}

function markSeeded(db: Database, value: Record<string, unknown>): void {
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [SEED_KEY, JSON.stringify(value)],
  )
}

/**
 * Seeds the default livestream scenes once (default-obs-scenes.json): a
 * church service's usual scenes, the songs, Bible and announcements scenes
 * switched to automatically, and the stream's start and stop scenes. A
 * church that already has scenes keeps its own; one that deletes them all
 * later does not get them back (the seed runs once).
 */
export function seedDefaultObsScenes(db: Database): void {
  const alreadySeeded = db
    .query('SELECT 1 FROM app_settings WHERE key = ?')
    .get(SEED_KEY)
  if (alreadySeeded) {
    log('debug', 'Default OBS scenes already seeded, skipping')
    return
  }

  if (hasRows(db, 'obs_scenes')) {
    log('debug', 'OBS scenes already exist, keeping them')
    markSeeded(db, { skipped: true, reason: 'scenes_exist' })
    return
  }

  defaultObsScenes.scenes.forEach((scene, sortOrder) => {
    db.run(
      `INSERT INTO obs_scenes
        (obs_scene_name, display_name, is_visible, sort_order, content_types, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?, unixepoch(), unixepoch())`,
      [
        scene.obsSceneName,
        scene.obsSceneName,
        sortOrder,
        JSON.stringify(scene.contentTypes),
      ],
    )
  })

  if (!hasRows(db, 'youtube_config')) {
    db.run(
      `INSERT INTO youtube_config (start_scene_name, stop_scene_name, created_at, updated_at)
        VALUES (?, ?, unixepoch(), unixepoch())`,
      [defaultObsScenes.startSceneName, defaultObsScenes.stopSceneName],
    )
  }

  markSeeded(db, { seeded: defaultObsScenes.scenes.length })
  log('info', `Seeded ${defaultObsScenes.scenes.length} default OBS scenes`)
}
