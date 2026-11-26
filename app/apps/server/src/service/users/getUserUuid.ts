import { getRawDatabase } from '../../db'

/** A user's sync uuid (their identity on every device), by local id. */
export function getUserUuid(userId: number): string | null {
  return (
    getRawDatabase()
      .query<{ uuid: string }, [number]>('SELECT uuid FROM users WHERE id = ?')
      .get(userId)?.uuid || null
  )
}
