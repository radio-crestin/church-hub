/**
 * Available features that can be controlled via permissions
 */
export type Feature =
  | 'songs'
  | 'schedules'
  | 'presentation'
  | 'settings'
  | 'programs'
  | 'displays'

/**
 * Permission action types
 */
export type Action = 'read' | 'write' | 'delete'

/**
 * All available features
 */
export const FEATURES: Feature[] = [
  'songs',
  'schedules',
  'presentation',
  'settings',
  'programs',
  'displays',
]

/**
 * Device record from database
 */
export interface Device {
  id: number
  name: string
  token_hash: string
  is_active: number
  last_used_at: number | null
  created_at: number
  updated_at: number
}

/**
 * Device permission record from database
 */
export interface DevicePermission {
  id: number
  device_id: number
  feature: Feature
  can_read: number
  can_write: number
  can_delete: number
  created_at: number
  updated_at: number
}

/**
 * Permission set for a single feature
 */
export interface FeaturePermissions {
  read: boolean
  write: boolean
  delete: boolean
}

/**
 * All permissions for a device
 */
export type DevicePermissions = Record<Feature, FeaturePermissions>

/**
 * Device with permissions (API response format)
 */
export interface DeviceWithPermissions {
  id: number
  name: string
  isActive: boolean
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
  permissions: DevicePermissions
}

/**
 * Input for creating a new device
 */
export interface CreateDeviceInput {
  name: string
  permissions: DevicePermissions
}

/**
 * Result of creating a device (includes plaintext token)
 */
export interface CreateDeviceResult {
  device: DeviceWithPermissions
  token: string
}

/**
 * Input for updating a device
 */
export interface UpdateDeviceInput {
  name?: string
  isActive?: boolean
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}

/**
 * Default permissions (all denied)
 */
export function getDefaultPermissions(): DevicePermissions {
  return {
    songs: { read: false, write: false, delete: false },
    schedules: { read: false, write: false, delete: false },
    presentation: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    programs: { read: false, write: false, delete: false },
    displays: { read: false, write: false, delete: false },
  }
}
