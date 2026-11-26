import type { Access } from './applyAccessChange'
import type { ChangeInput, EntityType } from './types'

/**
 * Only a super admin (or the church server) may make or change one: no
 * permission key grants it.
 */
export const SUPER_ADMIN = 'super_admin'

/** Each synced aggregate's permissions, the keys the app's routes check. */
const PERMISSIONS: Record<
  EntityType,
  Record<'create' | 'edit' | 'delete', string | null>
> = {
  song: { create: 'songs.create', edit: 'songs.edit', delete: 'songs.delete' },
  song_category: {
    create: 'songs.create',
    edit: 'songs.edit',
    delete: 'songs.delete',
  },
  song_group: {
    create: 'songs.create',
    edit: 'songs.edit',
    delete: 'songs.delete',
  },
  // A song editor adds a tag inline while editing a song.
  song_tag: { create: 'songs.edit', edit: 'songs.edit', delete: 'songs.delete' },
  song_bookmark: { create: 'songs.view', edit: 'songs.view', delete: 'songs.view' },
  song_bookmark_note: {
    create: 'songs.view',
    edit: 'songs.view',
    delete: 'songs.view',
  },
  bible_bookmark: { create: 'bible.view', edit: 'bible.view', delete: 'bible.view' },
  bible_bookmark_note: {
    create: 'bible.view',
    edit: 'bible.view',
    delete: 'bible.view',
  },
  schedule: {
    create: 'programs.create',
    edit: 'programs.edit',
    delete: 'programs.delete',
  },
  // Any signed-in user keeps playlists.
  music_playlist: { create: null, edit: null, delete: null },
  setting: {
    create: 'settings.edit',
    edit: 'settings.edit',
    delete: 'settings.edit',
  },
  role: { create: 'users.create', edit: 'users.edit', delete: 'users.delete' },
  user: { create: 'users.create', edit: 'users.edit', delete: 'users.delete' },
}

/**
 * The permission a change needs (null: any active user), with the keys the
 * app checks today. Making, changing or removing a super admin needs a
 * super admin.
 */
export function requiredPermission(
  change: ChangeInput,
  exists: boolean,
  access: Access
): string | null {
  if (change.type === 'user') {
    const current = access.users.find((user) => user.id === change.uuid)
    if (current?.isSuperAdmin || change.data?.isSuperAdmin) return SUPER_ADMIN
  }
  const action = change.op === 'delete' ? 'delete' : exists ? 'edit' : 'create'
  return PERMISSIONS[change.type][action]
}
