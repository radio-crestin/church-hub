import { getRawDatabase } from '../../../db'

/** A synced row's local id, by its sync identity. */
export function idByUuid(
  table: string,
  uuid: string,
  uuidColumn: 'uuid' | 'key' = 'uuid',
): number | null {
  return (
    getRawDatabase()
      .query<{ id: number }, [string]>(
        `SELECT id FROM ${table} WHERE ${uuidColumn} = ?`,
      )
      .get(uuid)?.id ?? null
  )
}
