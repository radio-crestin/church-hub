import type { SyncEntityType } from '../../db/schema/sync'

/**
 * The app settings that are the church's, not one device's: synced like any
 * other row, keyed by their name. Everything else stays on its device:
 * secrets (API keys, tokens, passwords, OAuth, host keys), per-device choices
 * (theme, language, shortcuts, layout, the player) and migration markers.
 */
export const SYNCED_SETTING_KEYS = [
  'search_synonyms',
  'sidebar_configuration',
  'bible_reading_speed',
  // Screen links (hashes only): the PC honours a phone's when it is back.
  'screen_links',
] as const

const SETTING_KEYS_SQL = SYNCED_SETTING_KEYS.map((key) => `'${key}'`).join(', ')

/** A table whose rows are synced aggregates (each with its own identity). */
export interface SyncedTable {
  entityType: SyncEntityType
  table: string
  /** The row's sync identity: a `uuid` column, or the settings' `key`. */
  uuidColumn: 'uuid' | 'key'
  /** Which rows sync (`R.` is NEW/OLD in triggers, the table elsewhere). */
  rowFilter?: string
  /**
   * The columns whose change is an edit; others (a user's last login) are
   * the device's own. All columns when absent.
   */
  editColumns?: string[]
}

/**
 * Every synced root table, in apply order (a row's references first).
 * Child rows (slides, items, permissions, tag assignments, playlist items)
 * travel inside their root's aggregate.
 */
export const SYNCED_TABLES: SyncedTable[] = [
  {
    entityType: 'role',
    table: 'roles',
    uuidColumn: 'uuid',
    editColumns: ['name', 'is_system'],
  },
  {
    entityType: 'user',
    table: 'users',
    uuidColumn: 'uuid',
    editColumns: ['name', 'is_active', 'is_super_admin', 'role_id'],
  },
  { entityType: 'song_category', table: 'song_categories', uuidColumn: 'uuid' },
  { entityType: 'song_group', table: 'song_groups', uuidColumn: 'uuid' },
  { entityType: 'song_tag', table: 'song_tags', uuidColumn: 'uuid' },
  // Presenting a song (its count, when last shown) is no edit of it. Its
  // background is: the media it shows reaches phones through the church's
  // bucket (service/cloud-media).
  {
    entityType: 'song',
    table: 'songs',
    uuidColumn: 'uuid',
    editColumns: [
      'title',
      'alternate_titles',
      'category_id',
      'song_group_id',
      'source_filename',
      'author',
      'copyright',
      'ccli',
      'tempo',
      'time_signature',
      'theme',
      'alt_theme',
      'hymn_number',
      'key_line',
      'presentation_order',
      'background',
      'last_manual_edit',
    ],
  },
  { entityType: 'song_bookmark', table: 'song_bookmarks', uuidColumn: 'uuid' },
  {
    entityType: 'song_bookmark_note',
    table: 'song_bookmark_notes',
    uuidColumn: 'uuid',
  },
  {
    entityType: 'bible_bookmark',
    table: 'bible_bookmarks',
    uuidColumn: 'uuid',
  },
  {
    entityType: 'bible_bookmark_note',
    table: 'bible_bookmark_notes',
    uuidColumn: 'uuid',
  },
  // The control room's queue is this device's, never a shared presentation.
  {
    entityType: 'schedule',
    table: 'schedules',
    uuidColumn: 'uuid',
    rowFilter: 'R.is_queue = 0',
  },
  {
    entityType: 'music_playlist',
    table: 'music_playlists',
    uuidColumn: 'uuid',
  },
  {
    entityType: 'setting',
    table: 'app_settings',
    uuidColumn: 'key',
    rowFilter: `R.key IN (${SETTING_KEYS_SQL})`,
  },
]

/** The rows of a synced table that sync (its identities), as SQL. */
export function syncedRowsSql(synced: SyncedTable): string {
  const filter = (synced.rowFilter ?? '1').replaceAll('R.', '')
  return `SELECT ${synced.uuidColumn} AS uuid FROM ${synced.table}
           WHERE ${synced.uuidColumn} != '' AND ${filter}`
}
