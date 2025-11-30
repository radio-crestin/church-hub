import type {
  CreateDeviceInput,
  CreateDeviceResult,
  Device,
  DevicePermission,
  DevicePermissions,
  DeviceWithPermissions,
  Feature,
  OperationResult,
  UpdateDeviceInput,
} from './types'
import { FEATURES, getDefaultPermissions } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] ${message}`)
}

/**
 * Generates a secure random device token
 */
export function generateDeviceToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `dev_${base64}`
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
 * Converts database device record to API format
 */
function toDeviceWithPermissions(
  device: Device,
  permissions: DevicePermissions,
): DeviceWithPermissions {
  return {
    id: device.id,
    name: device.name,
    isActive: device.is_active === 1,
    lastUsedAt: device.last_used_at,
    createdAt: device.created_at,
    updatedAt: device.updated_at,
    permissions,
  }
}

/**
 * Gets permissions for a device
 */
export function getDevicePermissions(deviceId: number): DevicePermissions {
  try {
    const db = getDatabase()
    const query = db.query(
      'SELECT * FROM device_permissions WHERE device_id = ?',
    )
    const results = query.all(deviceId) as DevicePermission[]

    const permissions = getDefaultPermissions()
    for (const perm of results) {
      if (FEATURES.includes(perm.feature)) {
        permissions[perm.feature] = {
          read: perm.can_read === 1,
          write: perm.can_write === 1,
          delete: perm.can_delete === 1,
        }
      }
    }

    return permissions
  } catch (error) {
    log('error', `Failed to get device permissions: ${error}`)
    return getDefaultPermissions()
  }
}

/**
 * Creates a new device with the specified permissions
 * Returns the device with its plaintext token (only time it's available)
 */
export async function createDevice(
  input: CreateDeviceInput,
): Promise<CreateDeviceResult | null> {
  try {
    log('debug', `Creating device: ${input.name}`)

    const db = getDatabase()
    const token = generateDeviceToken()
    const tokenHash = await hashToken(token)
    const now = Math.floor(Date.now() / 1000)

    // Insert device
    const insertDevice = db.query(`
      INSERT INTO devices (name, token_hash, is_active, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
    `)
    insertDevice.run(input.name, tokenHash, now, now)

    // Get the inserted device ID
    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const { id: deviceId } = getLastId.get() as { id: number }

    // Insert permissions for each feature
    const insertPerm = db.query(`
      INSERT INTO device_permissions (device_id, feature, can_read, can_write, can_delete, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    for (const feature of FEATURES) {
      const perms = input.permissions[feature] || {
        read: false,
        write: false,
        delete: false,
      }
      insertPerm.run(
        deviceId,
        feature,
        perms.read ? 1 : 0,
        perms.write ? 1 : 0,
        perms.delete ? 1 : 0,
        now,
        now,
      )
    }

    // Fetch the created device
    const device = getDeviceById(deviceId)
    if (!device) {
      log('error', 'Failed to fetch created device')
      return null
    }

    log('info', `Device created successfully: ${input.name} (ID: ${deviceId})`)
    return { device, token }
  } catch (error) {
    log('error', `Failed to create device: ${error}`)
    throw error
  }
}

/**
 * Gets all devices with their permissions
 */
export function getAllDevices(): DeviceWithPermissions[] {
  try {
    log('debug', 'Getting all devices')

    const db = getDatabase()
    const query = db.query('SELECT * FROM devices ORDER BY created_at DESC')
    const devices = query.all() as Device[]

    return devices.map((device) => {
      const permissions = getDevicePermissions(device.id)
      return toDeviceWithPermissions(device, permissions)
    })
  } catch (error) {
    log('error', `Failed to get all devices: ${error}`)
    return []
  }
}

/**
 * Gets a device by ID with its permissions
 */
export function getDeviceById(id: number): DeviceWithPermissions | null {
  try {
    log('debug', `Getting device by ID: ${id}`)

    const db = getDatabase()
    const query = db.query('SELECT * FROM devices WHERE id = ?')
    const device = query.get(id) as Device | null

    if (!device) {
      log('debug', `Device not found: ${id}`)
      return null
    }

    const permissions = getDevicePermissions(device.id)
    return toDeviceWithPermissions(device, permissions)
  } catch (error) {
    log('error', `Failed to get device: ${error}`)
    return null
  }
}

/**
 * Gets a device by token hash
 */
export async function getDeviceByToken(
  token: string,
): Promise<DeviceWithPermissions | null> {
  try {
    log('debug', 'Getting device by token')

    const db = getDatabase()
    const tokenHash = await hashToken(token)
    const query = db.query('SELECT * FROM devices WHERE token_hash = ?')
    const device = query.get(tokenHash) as Device | null

    if (!device) {
      log('debug', 'Device not found for token')
      return null
    }

    const permissions = getDevicePermissions(device.id)
    return toDeviceWithPermissions(device, permissions)
  } catch (error) {
    log('error', `Failed to get device by token: ${error}`)
    return null
  }
}

/**
 * Updates a device's name or status
 */
export function updateDevice(
  id: number,
  input: UpdateDeviceInput,
): OperationResult {
  try {
    log('debug', `Updating device: ${id}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const updates: string[] = []
    const values: (string | number)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }

    if (input.isActive !== undefined) {
      updates.push('is_active = ?')
      values.push(input.isActive ? 1 : 0)
    }

    if (updates.length === 0) {
      return { success: true }
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const query = db.query(
      `UPDATE devices SET ${updates.join(', ')} WHERE id = ?`,
    )
    query.run(...values)

    log('info', `Device updated successfully: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update device: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Deletes a device and its permissions
 */
export function deleteDevice(id: number): OperationResult {
  try {
    log('debug', `Deleting device: ${id}`)

    const db = getDatabase()

    // Delete permissions first (foreign key constraint)
    const deletePerm = db.query(
      'DELETE FROM device_permissions WHERE device_id = ?',
    )
    deletePerm.run(id)

    // Delete device
    const deleteDeviceQuery = db.query('DELETE FROM devices WHERE id = ?')
    deleteDeviceQuery.run(id)

    log('info', `Device deleted successfully: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete device: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Updates a device's permissions
 */
export function updateDevicePermissions(
  deviceId: number,
  permissions: DevicePermissions,
): OperationResult {
  try {
    log('debug', `Updating permissions for device: ${deviceId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    const upsertPerm = db.query(`
      INSERT INTO device_permissions (device_id, feature, can_read, can_write, can_delete, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, feature) DO UPDATE SET
        can_read = excluded.can_read,
        can_write = excluded.can_write,
        can_delete = excluded.can_delete,
        updated_at = excluded.updated_at
    `)

    for (const feature of FEATURES) {
      const perms = permissions[feature] || {
        read: false,
        write: false,
        delete: false,
      }
      upsertPerm.run(
        deviceId,
        feature,
        perms.read ? 1 : 0,
        perms.write ? 1 : 0,
        perms.delete ? 1 : 0,
        now,
        now,
      )
    }

    // Update device updated_at timestamp
    const updateDevice = db.query(
      'UPDATE devices SET updated_at = ? WHERE id = ?',
    )
    updateDevice.run(now, deviceId)

    log('info', `Permissions updated for device: ${deviceId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update device permissions: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Regenerates a device's token
 * Returns the new plaintext token (only time it's available)
 */
export async function regenerateDeviceToken(
  id: number,
): Promise<{ token: string } | null> {
  try {
    log('debug', `Regenerating token for device: ${id}`)

    const db = getDatabase()
    const token = generateDeviceToken()
    const tokenHash = await hashToken(token)
    const now = Math.floor(Date.now() / 1000)

    const query = db.query(
      'UPDATE devices SET token_hash = ?, updated_at = ? WHERE id = ?',
    )
    query.run(tokenHash, now, id)

    log('info', `Token regenerated for device: ${id}`)
    return { token }
  } catch (error) {
    log('error', `Failed to regenerate token: ${error}`)
    return null
  }
}

/**
 * Updates the last_used_at timestamp for a device
 */
export function updateDeviceLastUsed(id: number): void {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)
    const query = db.query('UPDATE devices SET last_used_at = ? WHERE id = ?')
    query.run(now, id)
  } catch (error) {
    log('error', `Failed to update last used: ${error}`)
  }
}

/**
 * Checks if a device has a specific permission
 */
export function hasPermission(
  permissions: DevicePermissions,
  feature: Feature,
  action: 'read' | 'write' | 'delete',
): boolean {
  const featurePerms = permissions[feature]
  if (!featurePerms) return false
  return featurePerms[action] === true
}
