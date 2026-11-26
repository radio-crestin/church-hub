import { eq } from 'drizzle-orm'

import { clearSyncVersions } from './syncVersionsStore'
import { getDatabase } from '../../../db'
import { cloudSync } from '../../../db/schema'

export type CloudIdentity = typeof cloudSync.$inferSelect

/** This server's church on the sync service, or null when not connected. */
export async function getCloudIdentity(): Promise<CloudIdentity | null> {
  const [row] = await getDatabase().select().from(cloudSync).limit(1)
  return row ?? null
}

/** Saves the church a registration returned (replacing any previous one). */
export async function saveCloudIdentity(
  identity: Pick<
    CloudIdentity,
    | 'serviceUrl'
    | 'churchId'
    | 'readUrl'
    | 'deviceId'
    | 'serverToken'
    | 'ownerEmail'
  >,
): Promise<void> {
  const db = getDatabase()
  await db.delete(cloudSync)
  clearSyncVersions()
  await db.insert(cloudSync).values({ id: 1, ...identity })
}

/**
 * Updates what a cycle learned (seq, head version, read path, access, the
 * owner) or what the owner changed (a fresh server token).
 */
export async function updateCloudIdentity(
  patch: Partial<
    Pick<
      CloudIdentity,
      | 'seq'
      | 'headEtag'
      | 'readUrl'
      | 'accessHash'
      | 'ownerEmail'
      | 'deviceId'
      | 'serverToken'
    >
  >,
): Promise<void> {
  await getDatabase()
    .update(cloudSync)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(cloudSync.id, 1))
}

/** Forgets the church (disconnecting), and the central versions with it. */
export async function clearCloudIdentity(): Promise<void> {
  await getDatabase().delete(cloudSync)
  clearSyncVersions()
}
