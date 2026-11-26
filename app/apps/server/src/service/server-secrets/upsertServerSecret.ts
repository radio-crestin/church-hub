import { sql } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { serverSecrets } from '../../db/schema'

export function upsertServerSecret(key: string, value: string): void {
  getDatabase()
    .insert(serverSecrets)
    .values({ key, value })
    .onConflictDoUpdate({
      target: serverSecrets.key,
      set: { value, updatedAt: sql`(unixepoch())` },
    })
    .run()
}
