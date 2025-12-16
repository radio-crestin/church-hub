import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'

export const roles = sqliteTable(
  'roles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    isSystem: integer('is_system', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_roles_name').on(table.name)],
)

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_role_permissions_role_id').on(table.roleId),
    unique('role_permission_unique').on(table.roleId, table.permission),
  ],
)

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    token: text('token').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    roleId: integer('role_id').references(() => roles.id, {
      onDelete: 'set null',
    }),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_users_token_hash').on(table.tokenHash),
    index('idx_users_is_active').on(table.isActive),
    index('idx_users_role_id').on(table.roleId),
  ],
)

export const userPermissions = sqliteTable(
  'user_permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_user_permissions_user_id').on(table.userId),
    unique('user_permission_unique').on(table.userId, table.permission),
  ],
)

export const appSessions = sqliteTable(
  'app_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionToken: text('session_token').notNull().unique(),
    sessionTokenHash: text('session_token_hash').notNull().unique(),
    name: text('name').notNull().default('Local Admin'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  },
  (table) => [index('idx_app_sessions_token_hash').on(table.sessionTokenHash)],
)
