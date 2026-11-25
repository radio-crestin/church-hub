import { and, eq, inArray } from 'drizzle-orm'
import type { SyncDb } from './getSyncDb'
import { entities } from './schema'
import type { ChangeInput } from './types'

/** D1 binds at most 100 parameters per statement. */
const UUIDS_PER_QUERY = 90

export interface EntityVersion {
  version: number
  deleted: boolean
}

/** The central version of every row the changes touch, by `type:uuid`. */
export async function loadEntityVersions(
  db: SyncDb,
  churchId: string,
  changes: ChangeInput[]
): Promise<Map<string, EntityVersion>> {
  const wanted = new Set(changes.map((c) => `${c.type}:${c.uuid}`))
  const uuids = [...new Set(changes.map((c) => c.uuid))]
  const found = new Map<string, EntityVersion>()
  for (let i = 0; i < uuids.length; i += UUIDS_PER_QUERY) {
    const rows = await db
      .select({
        type: entities.type,
        uuid: entities.uuid,
        version: entities.version,
        deleted: entities.deleted,
      })
      .from(entities)
      .where(
        and(
          eq(entities.churchId, churchId),
          inArray(entities.uuid, uuids.slice(i, i + UUIDS_PER_QUERY))
        )
      )
    for (const row of rows) {
      const key = `${row.type}:${row.uuid}`
      if (wanted.has(key)) {
        found.set(key, { version: row.version, deleted: row.deleted })
      }
    }
  }
  return found
}
