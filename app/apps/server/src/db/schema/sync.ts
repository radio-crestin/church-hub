import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/**
 * Entity types covered by Google Drive library sync. Each is an aggregate:
 * `song` includes its slides, `schedule` includes its items and nested verses.
 */
export const SYNC_ENTITY_TYPES = [
  'song',
  'song_category',
  'song_group',
  'schedule',
] as const

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number]

/**
 * Single-row configuration for Google Drive library sync (independent from the
 * whole-database backup feature, though it shares the same Drive connection).
 */
export const syncConfig = sqliteTable('sync_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  /** How often to poll Drive for remote changes when idle. */
  pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(5),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Single-row internal sync engine state (id = 1, created by migration).
 *
 * `applying` gates the change-tracking triggers: the engine sets it to 1 while
 * writing remote changes into the local DB so those writes are not re-recorded
 * as local edits (which would echo them back and forth between devices).
 */
export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey(),
  /** Random identifier of this installation, used to attribute file writes. */
  deviceId: text('device_id').notNull(),
  /** Human-readable machine name shown in the changes list (os.hostname). */
  deviceName: text('device_name').notNull().default(''),
  applying: integer('applying').notNull().default(0),
  /** Drive file id of the shared library file, once known. */
  remoteFileId: text('remote_file_id'),
  /** Drive-reported version of the library file at the last successful sync. */
  remoteFileVersion: text('remote_file_version'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Dirty set of aggregates changed locally since the last successful upload.
 * Populated by SQLite triggers on the synced tables; cleared by the engine
 * after the merged library file is uploaded to Drive.
 */
export const syncPending = sqliteTable(
  'sync_pending',
  {
    entityType: text('entity_type').notNull(),
    entityUuid: text('entity_uuid').notNull(),
    queuedAt: integer('queued_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.entityType, table.entityUuid] })],
)

/**
 * Local deletion markers. Hard deletes leave no row behind, so triggers record
 * one here; the merge carries them into the shared library file so other
 * devices delete their copy too. Pruned after `TOMBSTONE_RETENTION_DAYS`.
 */
export const syncTombstones = sqliteTable(
  'sync_tombstones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type').notNull(),
    entityUuid: text('entity_uuid').notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('idx_sync_tombstones_entity').on(
      table.entityType,
      table.entityUuid,
    ),
  ],
)

/**
 * Feed of changes applied from other devices, powering the "updated elsewhere"
 * badges in the songs and schedules lists. `conflict` marks rows where a local
 * unsynced edit was overwritten by a newer remote version (last-writer-wins).
 */
export const syncUpdates = sqliteTable(
  'sync_updates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type').notNull(),
    entityUuid: text('entity_uuid').notNull(),
    /** Local row id after apply (null when the entity was removed). */
    localId: integer('local_id'),
    changeKind: text('change_kind', {
      enum: ['added', 'updated', 'removed', 'conflict'],
    }).notNull(),
    /** Display title snapshot, so removed entities can still be named. */
    title: text('title').notNull(),
    /** Name of the device the change was made on (null when unattributed). */
    sourceDevice: text('source_device'),
    occurredAt: integer('occurred_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    seen: integer('seen', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    index('idx_sync_updates_seen').on(table.seen),
    index('idx_sync_updates_entity').on(table.entityType, table.entityUuid),
  ],
)
