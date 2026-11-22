#!/usr/bin/env bun

/**
 * Loads the copy of Adunare PC's database (the church's live data) into a
 * Church Hub data folder on the build and test machine, so the app can be
 * tested on the real songs, Bible, programs and settings.
 *
 * The copy (taken as in docs/test-machine.md) lives in ~/church-hub-data/adunare:
 * app.db, media/, song-sources/ and music/ (the MP3 library). This script never
 * changes that copy: it
 *   1. backs up whatever the target folder holds to ~/church-hub-backups/<stamp>/,
 *   2. copies app.db, media/ and song-sources/ into it (stale -wal/-shm removed),
 *   3. points the music library and the local backup folder at this machine,
 *   4. switches off what would reach the church's live gear and accounts:
 *      the mixer (10.4.101.3) and the YouTube sign-in.
 *
 * Usage (close the Church Hub that uses the target folder first):
 *   bun app/scripts/use-adunare-copy.ts <data dir>
 *   e.g. "%APPDATA%\church-hub" for the installed app, app/data for a dev server.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { Database } from 'bun:sqlite'

const SOURCE = join(homedir(), 'church-hub-data', 'adunare')
const COPIED = ['app.db', 'media', 'song-sources']
const ADUNARE_MUSIC =
  'C:\\Users\\Adunare\\Documents\\cantari\\Midi PDC\\midi-mp3-output\\midi-mp3-output'

const target = process.argv[2]
if (!target)
  throw new Error('usage: bun app/scripts/use-adunare-copy.ts <data dir>')
const dataDir = resolve(target)
if (!existsSync(join(SOURCE, 'app.db'))) {
  throw new Error(`no copy of Adunare's database in ${SOURCE}`)
}

function backUp(dir: string): void {
  if (!existsSync(dir) || readdirSync(dir).length === 0) return
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = join(
    homedir(),
    'church-hub-backups',
    `before-adunare-copy-${stamp}`,
  )
  cpSync(dir, backup, { recursive: true })
  // biome-ignore lint/suspicious/noConsole: where the old data went
  console.log(`backed up ${dir} → ${backup}`)
}

function copyIn(dir: string): void {
  mkdirSync(dir, { recursive: true })
  for (const suffix of ['-wal', '-shm'])
    rmSync(join(dir, `app.db${suffix}`), { force: true })
  for (const name of COPIED) {
    if (!existsSync(join(SOURCE, name))) continue
    rmSync(join(dir, name), { recursive: true, force: true })
    cpSync(join(SOURCE, name), join(dir, name), { recursive: true })
  }
}

function adaptToThisMachine(dir: string): void {
  const music = join(SOURCE, 'music')
  const backups = join(homedir(), 'Documents', 'ChurchHub Backups')
  const db = new Database(join(dir, 'app.db'))
  db.transaction(() => {
    db.run('UPDATE music_folders SET path = replace(path, ?, ?)', [
      ADUNARE_MUSIC,
      music,
    ])
    db.run('UPDATE music_files SET path = replace(path, ?, ?)', [
      ADUNARE_MUSIC,
      music,
    ])
    db.run(
      'UPDATE backup_config SET local_backup_path = ?, auto_backup_enabled = 0',
      [backups],
    )
    db.run('UPDATE mixer_config SET is_enabled = 0')
    db.run('DELETE FROM youtube_auth')
  })()
  db.close()
}

backUp(dataDir)
copyIn(dataDir)
adaptToThisMachine(dataDir)
// biome-ignore lint/suspicious/noConsole: the script's result
console.log(`Adunare's data is in ${dataDir}`)
