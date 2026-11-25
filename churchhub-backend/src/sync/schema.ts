import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

/**
 * The sync service's central state (D1 on Cloudflare, a SQLite file when
 * self-hosted). Mirrors migrations/0001_sync.sql, which creates the tables.
 */
export const churches = sqliteTable('churches', {
  id: text('id').primaryKey(),
  pathSecret: text('path_secret').notNull(),
  seq: integer('seq').notNull().default(0),
  commitNonce: text('commit_nonce'),
  snapshotSeq: integer('snapshot_seq').notNull().default(0),
  snapshotKey: text('snapshot_key'),
  ownerGoogleSub: text('owner_google_sub'),
  ownerEmail: text('owner_email'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey(),
    churchId: text('church_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: text('user_id'),
    name: text('name').notNull(),
    isServer: integer('is_server', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [index('idx_devices_church').on(table.churchId)]
)

export const roles = sqliteTable(
  'roles',
  {
    churchId: text('church_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    version: integer('version').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.churchId, table.id] })]
)

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    churchId: text('church_id').notNull(),
    roleId: text('role_id').notNull(),
    permission: text('permission').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.churchId, table.roleId, table.permission] }),
  ]
)

export const users = sqliteTable(
  'users',
  {
    churchId: text('church_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    roleId: text('role_id'),
    isSuperAdmin: integer('is_super_admin', { mode: 'boolean' })
      .notNull()
      .default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    version: integer('version').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.churchId, table.id] })]
)

export const userPermissions = sqliteTable(
  'user_permissions',
  {
    churchId: text('church_id').notNull(),
    userId: text('user_id').notNull(),
    permission: text('permission').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.churchId, table.userId, table.permission] }),
  ]
)

export const entities = sqliteTable(
  'entities',
  {
    churchId: text('church_id').notNull(),
    type: text('type').notNull(),
    uuid: text('uuid').notNull(),
    version: integer('version').notNull(),
    deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
    contentHash: text('content_hash'),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.churchId, table.type, table.uuid] })]
)

export const bucketObjects = sqliteTable(
  'bucket_objects',
  {
    churchId: text('church_id').notNull(),
    key: text('key').notNull(),
    kind: text('kind', { enum: ['log', 'snap'] }).notNull(),
    seq: integer('seq').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.churchId, table.key] }),
    index('idx_bucket_objects_seq').on(table.churchId, table.kind, table.seq),
  ]
)
