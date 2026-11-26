import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { serverSecrets } from '../../db/schema'
import { openSecret, secretPlaces } from '../secret-store'

/** The secret kept under `key`, or null when there is none it can open. */
export function readServerSecret(key: string): string | null {
  const stored = getDatabase()
    .select({ value: serverSecrets.value })
    .from(serverSecrets)
    .where(eq(serverSecrets.key, key))
    .get()?.value
  return stored ? openSecret(stored, secretPlaces.serverSecret(key)) : null
}
