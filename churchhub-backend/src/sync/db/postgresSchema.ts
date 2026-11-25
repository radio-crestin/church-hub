import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core'

/**
 * The sync service's central state on PostgreSQL (any server: self-hosted,
 * Neon, Supabase, RDS, or through Cloudflare Hyperdrive): the same tables,
 * columns and row types as sqliteSchema.ts. Times are Unix seconds.
 * Migrations: migrations/postgresql (npm run db:generate).
 */
const seconds = (name: string) => bigint(name, { mode: 'number' })

export const churches = pgTable('churches', {
  id: text('id').primaryKey(),
  pathSecret: text('path_secret').notNull(),
  seq: integer('seq').notNull().default(0),
  commitNonce: text('commit_nonce'),
  snapshotSeq: integer('snapshot_seq').notNull().default(0),
  snapshotKey: text('snapshot_key'),
  ownerGoogleSub: text('owner_google_sub'),
  ownerEmail: text('owner_email'),
  createdAt: seconds('created_at').notNull(),
  updatedAt: seconds('updated_at').notNull(),
})

export const devices = pgTable(
  'devices',
  {
    id: text('id').primaryKey(),
    churchId: text('church_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: text('user_id'),
    name: text('name').notNull(),
    isServer: boolean('is_server').notNull().default(false),
    createdAt: seconds('created_at').notNull(),
    revokedAt: seconds('revoked_at'),
  },
  (table) => [index('idx_devices_church').on(table.churchId)]
)

export const roles = pgTable(
  'roles',
  {
    churchId: text('church_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    version: integer('version').notNull(),
    updatedAt: seconds('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.churchId, table.id] })]
)

export const rolePermissions = pgTable(
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

export const users = pgTable(
  'users',
  {
    churchId: text('church_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    roleId: text('role_id'),
    isSuperAdmin: boolean('is_super_admin').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    version: integer('version').notNull(),
    updatedAt: seconds('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.churchId, table.id] })]
)

export const userPermissions = pgTable(
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

export const entities = pgTable(
  'entities',
  {
    churchId: text('church_id').notNull(),
    type: text('type').notNull(),
    uuid: text('uuid').notNull(),
    version: integer('version').notNull(),
    deleted: boolean('deleted').notNull().default(false),
    contentHash: text('content_hash'),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    updatedAt: seconds('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.churchId, table.type, table.uuid] })]
)

export const bucketObjects = pgTable(
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
