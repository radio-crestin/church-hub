import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { serverSecrets } from '../../db/schema'

export function readServerSecret(key: string): string | null {
  return (
    getDatabase()
      .select({ value: serverSecrets.value })
      .from(serverSecrets)
      .where(eq(serverSecrets.key, key))
      .get()?.value ?? null
  )
}
