import { asc, desc, eq, sql } from 'drizzle-orm'

import type {
  CreateUserInput,
  CreateUserResult,
  OperationResult,
  Permission,
  RoleWithPermissions,
  UpdateUserInput,
  UserWithPermissions,
} from './types'
import { ALL_PERMISSIONS } from './types'
import { getDatabase } from '../../db'
import { rolePermissions, roles, userPermissions, users } from '../../db/schema'

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
    const roleRecords = db.select().from(roles).orderBy(asc(roles.name)).all()

    return roleRecords.map((role) => {
      const permissions = db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id))
        .all()

      return {
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        permissions: permissions.map((p) => p.permission as Permission),
        createdAt:
          role.createdAt instanceof Date
            ? Math.floor(role.createdAt.getTime() / 1000)
            : (role.createdAt as unknown as number),
        updatedAt:
          role.updatedAt instanceof Date
            ? Math.floor(role.updatedAt.getTime() / 1000)
            : (role.updatedAt as unknown as number),
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
    const role = db.select().from(roles).where(eq(roles.id, id)).get()

    if (!role) return null

    const permissions = db
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id))
      .all()

    return {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: permissions.map((p) => p.permission as Permission),
      createdAt:
        role.createdAt instanceof Date
          ? Math.floor(role.createdAt.getTime() / 1000)
          : (role.createdAt as unknown as number),
      updatedAt:
        role.updatedAt instanceof Date
          ? Math.floor(role.updatedAt.getTime() / 1000)
          : (role.updatedAt as unknown as number),
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
      .select({ roleId: users.roleId })
      .from(users)
      .where(eq(users.id, userId))
      .get()

    const permissionSet = new Set<Permission>()

    // Get role permissions if user has a role
    if (user?.roleId) {
      const rolePerms = db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, user.roleId))
        .all()

      for (const p of rolePerms) {
        permissionSet.add(p.permission as Permission)
      }
    }

    // Get custom user permissions
    const userPerms = db
      .select({ permission: userPermissions.permission })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .all()

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
  user: typeof users.$inferSelect & { roleName: string | null },
  permissions: Permission[],
): UserWithPermissions {
  return {
    id: user.id,
    name: user.name,
    token: user.token,
    isActive: user.isActive,
    roleId: user.roleId,
    roleName: user.roleName,
    lastUsedAt:
      user.lastUsedAt instanceof Date
        ? Math.floor(user.lastUsedAt.getTime() / 1000)
        : (user.lastUsedAt as unknown as number | null),
    createdAt:
      user.createdAt instanceof Date
        ? Math.floor(user.createdAt.getTime() / 1000)
        : (user.createdAt as unknown as number),
    updatedAt:
      user.updatedAt instanceof Date
        ? Math.floor(user.updatedAt.getTime() / 1000)
        : (user.updatedAt as unknown as number),
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

    // Insert user with token stored for QR code display
    const inserted = db
      .insert(users)
      .values({
        name: input.name,
        token,
        tokenHash,
        isActive: true,
        roleId: input.roleId ?? null,
      })
      .returning({ id: users.id })
      .get()

    // Insert custom permissions if provided
    if (input.permissions && input.permissions.length > 0) {
      for (const permission of input.permissions) {
        db.insert(userPermissions)
          .values({
            userId: inserted.id,
            permission,
          })
          .run()
      }
    }

    // Fetch the created user
    const user = getUserById(inserted.id)
    if (!user) {
      log('error', 'Failed to fetch created user')
      return null
    }

    log('info', `User created successfully: ${input.name} (ID: ${inserted.id})`)
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
    const userRecords = db
      .select({
        id: users.id,
        name: users.name,
        token: users.token,
        tokenHash: users.tokenHash,
        isActive: users.isActive,
        roleId: users.roleId,
        lastUsedAt: users.lastUsedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .orderBy(desc(users.createdAt))
      .all()

    return userRecords.map((user) => {
      const permissions = getUserPermissions(user.id)
      return toUserWithPermissions(user, permissions)
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
    const user = db
      .select({
        id: users.id,
        name: users.name,
        token: users.token,
        tokenHash: users.tokenHash,
        isActive: users.isActive,
        roleId: users.roleId,
        lastUsedAt: users.lastUsedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .where(eq(users.id, id))
      .get()

    if (!user) {
      log('debug', `User not found: ${id}`)
      return null
    }

    const permissions = getUserPermissions(user.id)
    return toUserWithPermissions(user, permissions)
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
    const user = db
      .select({
        id: users.id,
        name: users.name,
        token: users.token,
        tokenHash: users.tokenHash,
        isActive: users.isActive,
        roleId: users.roleId,
        lastUsedAt: users.lastUsedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .where(eq(users.tokenHash, tokenHash))
      .get()

    if (!user) {
      log('debug', 'User not found for token')
      return null
    }

    const permissions = getUserPermissions(user.id)
    return toUserWithPermissions(user, permissions)
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

    // Build update object with only provided fields
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: sql`(unixepoch())` as unknown as Date,
    }

    if (input.name !== undefined) {
      updateData.name = input.name
    }

    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive
    }

    if (input.roleId !== undefined) {
      updateData.roleId = input.roleId
    }

    db.update(users).set(updateData).where(eq(users.id, id)).run()

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
    db.delete(userPermissions).where(eq(userPermissions.userId, id)).run()

    // Delete user
    db.delete(users).where(eq(users.id, id)).run()

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
export function updateUserPermissionsDb(
  userId: number,
  permissions: Permission[],
): OperationResult {
  try {
    log('debug', `Updating permissions for user: ${userId}`)

    const db = getDatabase()

    // Delete existing custom permissions
    db.delete(userPermissions).where(eq(userPermissions.userId, userId)).run()

    // Insert new permissions
    for (const permission of permissions) {
      db.insert(userPermissions)
        .values({
          userId,
          permission,
        })
        .run()
    }

    // Update user updated_at timestamp
    db.update(users)
      .set({ updatedAt: sql`(unixepoch())` as unknown as Date })
      .where(eq(users.id, userId))
      .run()

    log('info', `Permissions updated for user: ${userId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update user permissions: ${error}`)
    return { success: false, error: String(error) }
  }
}

// Re-export with original name for backwards compatibility
export { updateUserPermissionsDb as updateUserPermissions }

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

    // Update user's role
    db.update(users)
      .set({
        roleId,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(users.id, userId))
      .run()

    // Optionally clear custom permissions
    if (clearCustomPermissions) {
      db.delete(userPermissions).where(eq(userPermissions.userId, userId)).run()
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

    // Update both token and token_hash so QR code can be displayed
    db.update(users)
      .set({
        token,
        tokenHash,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(users.id, id))
      .run()

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
    db.update(users)
      .set({ lastUsedAt: sql`(unixepoch())` as unknown as Date })
      .where(eq(users.id, id))
      .run()
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
