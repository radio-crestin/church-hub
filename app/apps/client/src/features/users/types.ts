/**
 * Built-in permissions in the system
 */
export type BuiltInPermission =
  // Songs
  | 'songs.view'
  | 'songs.create'
  | 'songs.edit'
  | 'songs.delete'
  | 'songs.add_to_queue'
  | 'songs.present_now'
  // Song versions ("Versiuni ale cântării" — linked variants + auto-suggestions)
  | 'song_versions.view'
  | 'song_versions.create'
  | 'song_versions.edit'
  | 'song_versions.delete'
  // Bible
  | 'bible.view'
  | 'bible.import'
  | 'bible.delete'
  | 'bible.add_to_queue'
  | 'bible.present_now'
  // Control Room
  | 'control_room.view'
  | 'control_room.control'
  // Programs/Schedules
  | 'programs.view'
  | 'programs.create'
  | 'programs.edit'
  | 'programs.delete'
  | 'programs.import_to_queue'
  // Queue
  | 'queue.view'
  | 'queue.add'
  | 'queue.remove'
  | 'queue.reorder'
  | 'queue.clear'
  // Settings
  | 'settings.view'
  | 'settings.edit'
  | 'settings.edit_appearance'
  // Displays
  | 'displays.view'
  | 'displays.create'
  | 'displays.edit'
  | 'displays.delete'
  // Users
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  // Song Key Configuration
  | 'song_key.view'
  | 'song_key.edit'
  // Application Logs (view the local log files / clear them)
  | 'logs.view'
  | 'logs.clear'

/**
 * Dynamic permission for custom pages
 * Format: custom_page.{pageId}.view
 */
export type CustomPagePermission = `custom_page.${string}.view`

/**
 * All permissions including built-in and dynamic
 */
export type Permission = BuiltInPermission | CustomPagePermission

/**
 * Check if a permission string is a custom page permission
 */
export function isCustomPagePermission(
  permission: string,
): permission is CustomPagePermission {
  return permission.startsWith('custom_page.') && permission.endsWith('.view')
}

/**
 * All built-in permissions as an array (used for admin check)
 */
export const ALL_PERMISSIONS: BuiltInPermission[] = [
  // Songs
  'songs.view',
  'songs.create',
  'songs.edit',
  'songs.delete',
  'songs.add_to_queue',
  'songs.present_now',
  // Song versions
  'song_versions.view',
  'song_versions.create',
  'song_versions.edit',
  'song_versions.delete',
  // Bible
  'bible.view',
  'bible.import',
  'bible.delete',
  'bible.add_to_queue',
  'bible.present_now',
  // Control Room
  'control_room.view',
  'control_room.control',
  // Programs
  'programs.view',
  'programs.create',
  'programs.edit',
  'programs.delete',
  'programs.import_to_queue',
  // Queue
  'queue.view',
  'queue.add',
  'queue.remove',
  'queue.reorder',
  'queue.clear',
  // Settings
  'settings.view',
  'settings.edit',
  'settings.edit_appearance',
  // Displays
  'displays.view',
  'displays.create',
  'displays.edit',
  'displays.delete',
  // Users
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  // Song Key Configuration
  'song_key.view',
  'song_key.edit',
  // Application Logs
  'logs.view',
  'logs.clear',
]

/**
 * Permission groups for UI organization
 */
export const PERMISSION_GROUPS = {
  songs: [
    'songs.view',
    'songs.create',
    'songs.edit',
    'songs.delete',
    'songs.add_to_queue',
    'songs.present_now',
  ] as Permission[],
  song_versions: [
    'song_versions.view',
    'song_versions.create',
    'song_versions.edit',
    'song_versions.delete',
  ] as Permission[],
  bible: [
    'bible.view',
    'bible.import',
    'bible.delete',
    'bible.add_to_queue',
    'bible.present_now',
  ] as Permission[],
  control_room: ['control_room.view', 'control_room.control'] as Permission[],
  programs: [
    'programs.view',
    'programs.create',
    'programs.edit',
    'programs.delete',
    'programs.import_to_queue',
  ] as Permission[],
  queue: [
    'queue.view',
    'queue.add',
    'queue.remove',
    'queue.reorder',
    'queue.clear',
  ] as Permission[],
  settings: [
    'settings.view',
    'settings.edit',
    'settings.edit_appearance',
  ] as Permission[],
  displays: [
    'displays.view',
    'displays.create',
    'displays.edit',
    'displays.delete',
  ] as Permission[],
  users: [
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
  ] as Permission[],
  song_key: ['song_key.view', 'song_key.edit'] as Permission[],
  logs: ['logs.view', 'logs.clear'] as Permission[],
} as const

export type PermissionGroup = keyof typeof PERMISSION_GROUPS

/**
 * Role template names
 */
export type RoleTemplate =
  | 'admin'
  | 'presenter'
  | 'viewer'
  | 'queue_manager'
  | 'song_key_only'

/**
 * Role templates with their default permissions
 */
export const ROLE_TEMPLATES: Record<RoleTemplate, Permission[]> = {
  admin: ALL_PERMISSIONS,
  presenter: [
    'control_room.view',
    'control_room.control',
    'songs.view',
    'song_versions.view',
    'songs.add_to_queue',
    'songs.present_now',
    'bible.view',
    'bible.add_to_queue',
    'bible.present_now',
    'queue.view',
    'queue.add',
    'queue.remove',
    'queue.reorder',
    'programs.view',
    'programs.import_to_queue',
    'displays.view',
  ],
  viewer: [
    'control_room.view',
    'songs.view',
    'song_versions.view',
    'bible.view',
    'programs.view',
    'queue.view',
    'displays.view',
  ],
  queue_manager: [
    'queue.view',
    'queue.add',
    'queue.remove',
    'queue.reorder',
    'queue.clear',
    'songs.view',
    'song_versions.view',
    'songs.add_to_queue',
    'programs.view',
    'programs.import_to_queue',
    'control_room.view',
  ],
  song_key_only: ['song_key.view', 'song_key.edit'],
}

/**
 * Role with permissions (API response format)
 */
export interface RoleWithPermissions {
  id: number
  name: string
  isSystem: boolean
  permissions: Permission[]
  createdAt: number
  updatedAt: number
}

/**
 * User with permissions (API response format)
 */
export interface UserWithPermissions {
  id: number
  name: string
  token: string
  isActive: boolean
  isSuperAdmin: boolean
  /** Whether a login password is set (the hash is never exposed). */
  hasPassword: boolean
  roleId: number | null
  roleName: string | null
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
  permissions: Permission[]
}

/**
 * Minimal user info shown on the local login screen.
 */
export interface LocalUser {
  id: number
  name: string
  isSuperAdmin: boolean
  hasPassword: boolean
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  name: string
  roleId?: number
  permissions?: Permission[]
  /** Optional login password (omit/empty for a passwordless user). */
  password?: string
}

/**
 * Result of creating a user (includes plaintext token)
 */
export interface CreateUserResult {
  user: UserWithPermissions
  token: string
}

/**
 * Input for updating a user
 */
export interface UpdateUserInput {
  name?: string
  isActive?: boolean
  roleId?: number | null
}

/**
 * Current user's auth info from /api/auth/me
 */
export interface CurrentUser {
  id: number
  name: string
  permissions: Permission[]
  isApp: boolean
}
