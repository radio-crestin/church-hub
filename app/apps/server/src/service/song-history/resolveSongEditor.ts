import type { SongEditor } from './types'
import { getUserById } from '../users'

/** Name shown when a change came from the system token (no signed-in user). */
export const SYSTEM_EDITOR_NAME = 'System'

/** Who made a change: the signed-in user, or "System" when there is none. */
export function resolveSongEditor(userId: number | undefined): SongEditor {
  const user = userId === undefined ? null : getUserById(userId)
  if (!user) return { userId: null, name: SYSTEM_EDITOR_NAME }
  return { userId: user.id, name: user.name }
}
