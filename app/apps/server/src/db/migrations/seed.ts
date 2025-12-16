import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed:${level}] ${message}`)
}

const ALL_PERMISSIONS = [
  'songs.view',
  'songs.create',
  'songs.edit',
  'songs.delete',
  'songs.add_to_queue',
  'songs.present_now',
  'bible.view',
  'bible.import',
  'bible.delete',
  'bible.add_to_queue',
  'bible.present_now',
  'control_room.view',
  'control_room.control',
  'programs.view',
  'programs.create',
  'programs.edit',
  'programs.delete',
  'programs.import_to_queue',
  'queue.view',
  'queue.add',
  'queue.remove',
  'queue.reorder',
  'queue.clear',
  'settings.view',
  'settings.edit',
  'displays.view',
  'displays.create',
  'displays.edit',
  'displays.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
]

const ROLE_TEMPLATES: Record<string, string[]> = {
  admin: ALL_PERMISSIONS,
  presenter: [
    'control_room.view',
    'control_room.control',
    'songs.view',
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
    'songs.add_to_queue',
    'bible.view',
    'bible.add_to_queue',
    'programs.view',
    'programs.import_to_queue',
    'control_room.view',
  ],
}

/**
 * Seeds system roles and their permissions
 * Uses INSERT OR IGNORE to avoid duplicates on subsequent runs
 */
export function seedSystemRoles(db: Database): void {
  log('debug', 'Seeding system roles and permissions...')

  for (const [roleName, permissions] of Object.entries(ROLE_TEMPLATES)) {
    // Insert role if it doesn't exist
    db.run('INSERT OR IGNORE INTO roles (name, is_system) VALUES (?, 1)', [
      roleName,
    ])

    // Get the role ID
    const role = db
      .query('SELECT id FROM roles WHERE name = ?')
      .get(roleName) as { id: number } | null

    if (role) {
      // Insert permissions for this role
      for (const permission of permissions) {
        db.run(
          'INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)',
          [role.id, permission],
        )
      }
      log(
        'debug',
        `Seeded role: ${roleName} with ${permissions.length} permissions`,
      )
    }
  }

  log('debug', 'System roles seeding complete')
}
