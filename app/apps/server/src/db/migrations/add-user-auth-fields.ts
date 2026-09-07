import { createHash, randomBytes } from 'node:crypto'
import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-user-auth-fields:${level}] ${message}`)
}

/**
 * Generates a secure random user token (mirrors generateUserToken in the
 * users service, kept here so the migration has no service dependency).
 */
function generateUserToken(): string {
  const base64 = randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `usr_${base64}`
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Adds the auth-related columns introduced by the users/permissions feature:
 *  - `is_super_admin`: marks the built-in owner account (always full access).
 *  - `password_hash`: optional Argon2id login password (null = none).
 *
 * Then bootstraps a single Super Admin user when none exists yet so a fresh
 * install (and existing token-only databases) always has an owner identity.
 * Idempotent: safe to run on every boot.
 */
export function addUserAuthFields(db: Database): void {
  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(users)')
    .all()

  if (!columns.some((col) => col.name === 'is_super_admin')) {
    log('info', 'Adding "is_super_admin" column (default 0)...')
    db.run(
      'ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0',
    )
  }

  if (!columns.some((col) => col.name === 'password_hash')) {
    log('info', 'Adding "password_hash" column...')
    db.run('ALTER TABLE users ADD COLUMN password_hash TEXT')
  }

  ensureSuperAdmin(db)
}

/**
 * Creates the Super Admin owner account if none exists. The admin role
 * (seeded by seedSystemRoles) supplies its permissions. No password is set
 * initially — local login is frictionless until the owner sets one.
 */
function ensureSuperAdmin(db: Database): void {
  const existing = db
    .query<{ count: number }, []>(
      'SELECT COUNT(*) as count FROM users WHERE is_super_admin = 1',
    )
    .get()?.count

  if (existing && existing > 0) {
    log('debug', 'Super admin already exists, skipping bootstrap')
    return
  }

  const adminRole = db
    .query<{ id: number }, []>("SELECT id FROM roles WHERE name = 'admin'")
    .get()

  const token = generateUserToken()
  const tokenHash = sha256(token)

  log('info', 'Bootstrapping Super Admin account (no password)...')
  db.run(
    `INSERT INTO users (name, token, token_hash, is_active, is_super_admin, role_id, created_at, updated_at)
     VALUES (?, ?, ?, 1, 1, ?, unixepoch(), unixepoch())`,
    ['Super Admin', token, tokenHash, adminRole?.id ?? null],
  )
}
