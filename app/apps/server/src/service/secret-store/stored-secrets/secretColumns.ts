import { renewSystemToken, renewUserToken } from './renewToken'
import type { Database } from 'bun:sqlite'

/** What the user has to set up again after a restore from another computer. */
export type SecretFeature =
  | 'youtube'
  | 'google-drive'
  | 'cloud-sync'
  | 'listener-link'
  | 'remote-access'
  | 'cloud-backup'
  | 'obs'
  | 'song-sources'
  | 'ai-search'
  | 'live-translation'
  | 'users'

/**
 * A column holding a secret. Every value in it is sealed (secretPlaces has
 * its place: table, column and, with `rowKey`, that column's value).
 */
export interface SecretColumn {
  table: string
  column: string
  rowKey?: string
  /** Who must set it up again; null when the server renews it itself. */
  feature: (rowKey: string | undefined) => SecretFeature | null
  /** Puts the row back to "not set up" (or renews the secret). */
  forget: (db: Database, rowid: number, rowKey: string | undefined) => void
}

const SERVER_SECRET_FEATURES: Record<string, SecretFeature> = {
  live_translation_host_key: 'listener-link',
  remote_access_host_key: 'remote-access',
  cloud_backup_credential: 'cloud-backup',
}

const deleteRow = (table: string) => (db: Database, rowid: number) =>
  db.run(`DELETE FROM ${table} WHERE rowid = ?`, [rowid])

const blank =
  (table: string, column: string) => (db: Database, rowid: number) =>
    db.run(`UPDATE ${table} SET ${column} = '' WHERE rowid = ?`, [rowid])

/** A host key is made anew on first use; a new listener link is announced. */
function forgetServerSecret(db: Database, rowid: number, key = '') {
  deleteRow('server_secrets')(db, rowid)
  if (key !== 'live_translation_host_key') return
  db.run(
    `INSERT INTO app_settings (key, value) VALUES ('live_translation_link_changed', 'true')
     ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = unixepoch()`,
  )
}

/** As disconnectCloudSync: the church's owner recovers it on this computer. */
function forgetCloudChurch(db: Database) {
  db.run('DELETE FROM cloud_sync')
  db.run('DELETE FROM sync_versions')
  db.run(
    "UPDATE sync_config SET transport = 'drive', sync_enabled = 0, last_error = NULL",
  )
}

/** Every column holding a secret: the one list (settings fields: secretSettingFields). */
export const SECRET_COLUMNS: readonly SecretColumn[] = [
  {
    table: 'server_secrets',
    column: 'value',
    rowKey: 'key',
    feature: (key = '') => SERVER_SECRET_FEATURES[key] ?? null,
    forget: forgetServerSecret,
  },
  ...['access_token', 'refresh_token'].map((column) => ({
    table: 'youtube_auth',
    column,
    feature: () => 'youtube' as const,
    forget: deleteRow('youtube_auth'),
  })),
  ...['access_token', 'refresh_token'].map((column) => ({
    table: 'google_drive_auth',
    column,
    feature: () => 'google-drive' as const,
    forget: deleteRow('google_drive_auth'),
  })),
  ...['server_token', 'read_url'].map((column) => ({
    table: 'cloud_sync',
    column,
    feature: () => 'cloud-sync' as const,
    forget: forgetCloudChurch,
  })),
  {
    table: 'obs_config',
    column: 'password',
    feature: () => 'obs',
    forget: blank('obs_config', 'password'),
  },
  {
    table: 'song_source_storage',
    column: 'secret_access_key',
    feature: () => 'song-sources',
    forget: blank('song_source_storage', 'secret_access_key'),
  },
  {
    table: 'users',
    column: 'token',
    rowKey: 'token_hash',
    feature: () => 'users',
    forget: renewUserToken,
  },
  {
    table: 'app_sessions',
    column: 'session_token',
    rowKey: 'name',
    feature: () => null,
    forget: (db, rowid, name = '') => renewSystemToken(db, rowid, name),
  },
]

/** Settings fields' features, by settings key. */
export const SETTING_FEATURES: Record<string, SecretFeature> = {
  songs_ai_search_config: 'ai-search',
  bible_ai_search_config: 'ai-search',
  ai_search_config: 'ai-search',
  live_translation_settings: 'live-translation',
}
