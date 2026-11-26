import type { EntityType } from './types'

/** The app's permission area of each synced aggregate (service/users/types.ts). */
const AREA_BY_TYPE: Record<EntityType, string> = {
  song: 'songs',
  song_category: 'songs',
  song_group: 'songs',
  schedule: 'programs',
}

/**
 * The permission a change needs, with the keys the app checks today:
 * creating `songs.create`, changing `songs.edit`, deleting `songs.delete`
 * (`programs.*` for schedules).
 */
export function requiredPermission(
  type: EntityType,
  op: 'upsert' | 'delete',
  exists: boolean
): string {
  const action = op === 'delete' ? 'delete' : exists ? 'edit' : 'create'
  return `${AREA_BY_TYPE[type]}.${action}`
}
