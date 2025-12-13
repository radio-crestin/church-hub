import type {
  CreateUserInput,
  CreateUserResult,
  OperationResult,
  Permission,
  Role,
  RoleWithPermissions,
  UpdateUserInput,
  User,
  UserWithPermissions,
} from './types'
import { ALL_PERMISSIONS } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] ${message}`)
}

/**
 * Generates a secure random user token
 */
export function generateUserToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `usr_${base64}`
}

/**
 * Hashes a token using SHA-256
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Gets all roles with their permissions
 */
export function getAllRoles(): RoleWithPermissions[] {
  try {
    const db = getDatabase()
    const roles = db.query('SELECT * FROM roles ORDER BY name').all() as Role[]

    return roles.map((role) => {
      const permissions = db
        .query('SELECT permission FROM role_permissions WHERE role_id = ?')
        .all(role.id) as Array<{ permission: string }>

      return {
        id: role.id,
        name: role.name,
        isSystem: role.is_system === 1,
        permissions: permissions.map((p) => p.permission as Permission),
        createdAt: role.created_at,
        updatedAt: role.updated_at,
      }
    })
  } catch (error) {
    log('error', `Failed to get roles: ${error}`)
    return []
  }
}

/**
 * Gets a role by ID with permissions
 */
export function getRoleById(id: number): RoleWithPermissions | null {
  try {
    const db = getDatabase()
    const role = db
      .query('SELECT * FROM roles WHERE id = ?')
      .get(id) as Role | null

    if (!role) return null

    const permissions = db
      .query('SELECT permission FROM role_permissions WHERE role_id = ?')
      .all(role.id) as Array<{ permission: string }>

    return {
      id: role.id,
      name: role.name,
      isSystem: role.is_system === 1,
      permissions: permissions.map((p) => p.permission as Permission),
      createdAt: role.created_at,
      updatedAt: role.updated_at,
    }
  } catch (error) {
    log('error', `Failed to get role: ${error}`)
    return null
  }
}

/**
 * Gets permissions for a user (combines role permissions + custom permissions)
 */
export function getUserPermissions(userId: number): Permission[] {
  try {
    const db = getDatabase()

    // Get user's role
    const user = db
      .query('SELECT role_id FROM users WHERE id = ?')
      .get(userId) as { role_id: number | null } | null

    const permissionSet = new Set<Permission>()

    // Get role permissions if user has a role
    if (user?.role_id) {
      const rolePerms = db
        .query('SELECT permission FROM role_permissions WHERE role_id = ?')
        .all(user.role_id) as Array<{ permission: string }>

      for (const p of rolePerms) {
        permissionSet.add(p.permission as Permission)
      }
    }

    // Get custom user permissions
    const userPerms = db
      .query('SELECT permission FROM user_permissions WHERE user_id = ?')
      .all(userId) as Array<{ permission: string }>

    for (const p of userPerms) {
      permissionSet.add(p.permission as Permission)
    }

    return Array.from(permissionSet)
  } catch (error) {
    log('error', `Failed to get user permissions: ${error}`)
    return []
  }
}

/**
 * Converts database user record to API format
 */
function toUserWithPermissions(
  user: User,
  permissions: Permission[],
  roleName: string | null,
): UserWithPermissions {
  return {
    id: user.id,
    name: user.name,
    token: user.token,
    isActive: user.is_active === 1,
    roleId: user.role_id,
    roleName,
    lastUsedAt: user.last_used_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    permissions,
  }
}

/**
 * Creates a new user with the specified role/permissions
 * Returns the user with its plaintext token (only time it's available)
 */
export async function createUser(
  input: CreateUserInput,
): Promise<CreateUserResult | null> {
  try {
    log('debug', `Creating user: ${input.name}`)

    const db = getDatabase()
    const token = generateUserToken()
    const tokenHash = await hashToken(token)
    const now = Math.floor(Date.now() / 1000)

    // Insert user with token stored for QR code display
    const insertUser = db.query(`
      INSERT INTO users (name, token, token_hash, is_active, role_id, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?, ?)
    `)
    insertUser.run(input.name, token, tokenHash, input.roleId ?? null, now, now)

    // Get the inserted user ID
    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id: userId } = getLastId.get() as { id: number }

    // Insert custom permissions if provided
    if (input.permissions && input.permissions.length > 0) {
      const insertPerm = db.query(`
        INSERT INTO user_permissions (user_id, permission, created_at)
        VALUES (?, ?, ?)
      `)

      for (const permission of input.permissions) {
        insertPerm.run(userId, permission, now)
      }
    }

    // Fetch the created user
    const user = getUserById(userId)
    if (!user) {
      log('error', 'Failed to fetch created user')
      return null
    }

    log('info', `User created successfully: ${input.name} (ID: ${userId})`)
    return { user, token }
  } catch (error) {
    log('error', `Failed to create user: ${error}`)
    throw error
  }
}

/**
 * Gets all users with their permissions
 */
export function getAllUsers(): UserWithPermissions[] {
  try {
    log('debug', 'Getting all users')

    const db = getDatabase()
    const query = db.query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `)
    const users = query.all() as Array<User & { role_name: string | null }>

    return users.map((user) => {
      const permissions = getUserPermissions(user.id)
      return toUserWithPermissions(user, permissions, user.role_name)
    })
  } catch (error) {
    log('error', `Failed to get all users: ${error}`)
    return []
  }
}

/**
 * Gets a user by ID with permissions
 */
export function getUserById(id: number): UserWithPermissions | null {
  try {
    log('debug', `Getting user by ID: ${id}`)

    const db = getDatabase()
    const query = db.query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `)
    const user = query.get(id) as (User & { role_name: string | null }) | null

    if (!user) {
      log('debug', `User not found: ${id}`)
      return null
    }

    const permissions = getUserPermissions(user.id)
    return toUserWithPermissions(user, permissions, user.role_name)
  } catch (error) {
    log('error', `Failed to get user: ${error}`)
    return null
  }
}

/**
 * Gets a user by token hash
 */
export async function getUserByToken(
  token: string,
): Promise<UserWithPermissions | null> {
  try {
    log('debug', 'Getting user by token')

    const db = getDatabase()
    const tokenHash = await hashToken(token)
    const query = db.query(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.token_hash = ?
    `)
    const user = query.get(tokenHash) as
      | (User & { role_name: string | null })
      | null

    if (!user) {
      log('debug', 'User not found for token')
      return null
    }

    const permissions = getUserPermissions(user.id)
    return toUserWithPermissions(user, permissions, user.role_name)
  } catch (error) {
    log('error', `Failed to get user by token: ${error}`)
    return null
  }
}

/**
 * Updates a user's name, status, or role
 */
export function updateUser(
  id: number,
  input: UpdateUserInput,
): OperationResult {
  try {
    log('debug', `Updating user: ${id}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }

    if (input.isActive !== undefined) {
      updates.push('is_active = ?')
      values.push(input.isActive ? 1 : 0)
    }

    if (input.roleId !== undefined) {
      updates.push('role_id = ?')
      values.push(input.roleId)
    }

    if (updates.length === 0) {
      return { success: true }
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const query = db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    )
    query.run(...values)

    log('info', `User updated successfully: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update user: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Deletes a user and their permissions
 */
export function deleteUser(id: number): OperationResult {
  try {
    log('debug', `Deleting user: ${id}`)

    const db = getDatabase()

    // Delete permissions first (foreign key constraint)
    const deletePerm = db.query(
      'DELETE FROM user_permissions WHERE user_id = ?',
    )
    deletePerm.run(id)

    // Delete user
    const deleteUserQuery = db.query('DELETE FROM users WHERE id = ?')
    deleteUserQuery.run(id)

    log('info', `User deleted successfully: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete user: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Updates a user's custom permissions
 */
export function updateUserPermissions(
  userId: number,
  permissions: Permission[],
): OperationResult {
  try {
    log('debug', `Updating permissions for user: ${userId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Delete existing custom permissions
    db.query('DELETE FROM user_permissions WHERE user_id = ?').run(userId)

    // Insert new permissions
    const insertPerm = db.query(`
      INSERT INTO user_permissions (user_id, permission, created_at)
      VALUES (?, ?, ?)
    `)

    for (const permission of permissions) {
      insertPerm.run(userId, permission, now)
    }

    // Update user updated_at timestamp
    const updateUser = db.query('UPDATE users SET updated_at = ? WHERE id = ?')
    updateUser.run(now, userId)

    log('info', `Permissions updated for user: ${userId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update user permissions: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Sets a user's role (and optionally clears custom permissions)
 */
export function setUserRole(
  userId: number,
  roleId: number | null,
  clearCustomPermissions = false,
): OperationResult {
  try {
    log('debug', `Setting role for user: ${userId} to ${roleId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Update user's role
    db.query('UPDATE users SET role_id = ?, updated_at = ? WHERE id = ?').run(
      roleId,
      now,
      userId,
    )

    // Optionally clear custom permissions
    if (clearCustomPermissions) {
      db.query('DELETE FROM user_permissions WHERE user_id = ?').run(userId)
    }

    log('info', `Role set for user: ${userId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to set user role: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Regenerates a user's token
 * Returns the new plaintext token
 */
export async function regenerateUserToken(
  id: number,
): Promise<{ token: string } | null> {
  try {
    log('debug', `Regenerating token for user: ${id}`)

    const db = getDatabase()
    const token = generateUserToken()
    const tokenHash = await hashToken(token)
    const now = Math.floor(Date.now() / 1000)

    // Update both token and token_hash so QR code can be displayed
    const query = db.query(
      'UPDATE users SET token = ?, token_hash = ?, updated_at = ? WHERE id = ?',
    )
    query.run(token, tokenHash, now, id)

    log('info', `Token regenerated for user: ${id}`)
    return { token }
  } catch (error) {
    log('error', `Failed to regenerate token: ${error}`)
    return null
  }
}

/**
 * Updates the last_used_at timestamp for a user
 */
export function updateUserLastUsed(id: number): void {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const query = db.query('UPDATE users SET last_used_at = ? WHERE id = ?')
    query.run(now, id)
  } catch (error) {
    log('error', `Failed to update last used: ${error}`)
  }
}

/**
 * Checks if a user has a specific permission
 */
export function hasPermission(
  permissions: Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission)
}

/**
 * Checks if a user has any of the specified permissions
 */
export function hasAnyPermission(
  permissions: Permission[],
  requiredPermissions: Permission[],
): boolean {
  return requiredPermissions.some((p) => permissions.includes(p))
}

/**
 * Checks if a user has all of the specified permissions
 */
export function hasAllPermissions(
  permissions: Permission[],
  requiredPermissions: Permission[],
): boolean {
  return requiredPermissions.every((p) => permissions.includes(p))
}

/**
 * Checks if a user is an admin (has all permissions)
 */
export function isAdmin(permissions: Permission[]): boolean {
  return ALL_PERMISSIONS.every((p) => permissions.includes(p))
}
