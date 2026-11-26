import { sql } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { serverSecrets } from '../../db/schema'
import { sealSecret, secretPlaces } from '../secret-store'

/** Keeps `value` under `key`, sealed. */
export function upsertServerSecret(key: string, plain: string): void {
  const value = sealSecret(plain, secretPlaces.serverSecret(key))
  getDatabase()
    .insert(serverSecrets)
    .values({ key, value })
    .onConflictDoUpdate({
      target: serverSecrets.key,
      set: { value, updatedAt: sql`(unixepoch())` },
    })
    .run()
}
