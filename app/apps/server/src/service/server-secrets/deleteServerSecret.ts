import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { serverSecrets } from '../../db/schema'

export function deleteServerSecret(key: string): void {
  getDatabase().delete(serverSecrets).where(eq(serverSecrets.key, key)).run()
}
