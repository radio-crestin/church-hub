/**
 * All action-specific permissions in the system
 */
export type Permission =
  // Songs
  | 'songs.view'
  | 'songs.create'
  | 'songs.edit'
  | 'songs.delete'
  | 'songs.add_to_queue'
  | 'songs.present_now'
  // Song versions ("Versiuni ale cântării" — linked variants of the same
  // hymn, plus auto-suggested matches). View is intentionally tied to
  // `songs.view` (whoever can see a song can see its variants); these
  // gate the mutate actions so admins can grant "manage versions" without
  // granting the song write perms.
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

/**
 * All available permissions as an array
 */
export const ALL_PERMISSIONS: Permission[] = [
  // Songs
  'songs.view',
  'songs.create',
  'songs.edit',
  'songs.delete',
  'songs.add_to_queue',
  'songs.present_now',
  // Song versions (view inherits from songs.view; only mutate perms)
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
  settings: ['settings.view', 'settings.edit'] as Permission[],
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
    'songs.add_to_queue',
    'songs.present_now',
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
    'songs.add_to_queue',
    'programs.view',
    'programs.import_to_queue',
    'control_room.view',
  ],
  song_key_only: ['song_key.view', 'song_key.edit', 'songs.view'],
}

/**
 * Role record from database
 */
export interface Role {
  id: number
  name: string
  is_system: number
  created_at: number
  updated_at: number
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
 * User record from database
 */
export interface User {
  id: number
  name: string
  token: string
  token_hash: string
  is_active: number
  role_id: number | null
  last_used_at: number | null
  created_at: number
  updated_at: number
}

/**
 * User permission record from database
 */
export interface UserPermission {
  id: number
  user_id: number
  permission: string
  created_at: number
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
  /** Whether a login password is set (the hash itself is never exposed). */
  hasPassword: boolean
  roleId: number | null
  roleName: string | null
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
  permissions: Permission[]
}

/**
 * Minimal user info exposed publicly on the local login screen.
 * Never includes tokens, permissions, or password hashes.
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
  /** Optional login password. Omitted/empty = passwordless user. */
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
 * Input for setting/clearing a user's login password.
 * `password: null` (or empty) removes the password.
 */
export interface SetPasswordInput {
  password: string | null
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
