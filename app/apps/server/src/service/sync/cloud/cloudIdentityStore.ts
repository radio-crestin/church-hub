import { eq } from 'drizzle-orm'

import { clearSyncVersions } from './syncVersionsStore'
import { getDatabase } from '../../../db'
import { cloudSync } from '../../../db/schema'
import { openSecret, sealSecret, secretPlaces } from '../../secret-store'

export type CloudIdentity = typeof cloudSync.$inferSelect

/** The identity's secrets as stored: sealed. */
const sealSecrets = (
  identity: Partial<Pick<CloudIdentity, 'serverToken' | 'readUrl'>>,
) => ({
  ...(identity.serverToken !== undefined && {
    serverToken: sealSecret(
      identity.serverToken,
      secretPlaces.cloudServerToken,
    ),
  }),
  ...(identity.readUrl !== undefined && {
    readUrl: sealSecret(identity.readUrl, secretPlaces.cloudReadUrl),
  }),
})

/**
 * This server's church on the sync service, its server token and read path
 * opened, or null when not connected (or they can't be opened: the owner
 * recovers the church).
 */
export async function getCloudIdentity(): Promise<CloudIdentity | null> {
  const [row] = await getDatabase().select().from(cloudSync).limit(1)
  if (!row) return null
  const serverToken = openSecret(row.serverToken, secretPlaces.cloudServerToken)
  const readUrl = openSecret(row.readUrl, secretPlaces.cloudReadUrl)
  if (serverToken === null || readUrl === null) return null
  return { ...row, serverToken, readUrl }
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
  await db.insert(cloudSync).values({
    id: 1,
    ...identity,
    ...sealSecrets(identity),
  })
}

/**
 * Updates what a cycle learned (seq, head version, read path, the
 * owner) or what the owner changed (a fresh server token).
 */
export async function updateCloudIdentity(
  patch: Partial<
    Pick<
      CloudIdentity,
      'seq' | 'headEtag' | 'readUrl' | 'ownerEmail' | 'deviceId' | 'serverToken'
    >
  >,
): Promise<void> {
  await getDatabase()
    .update(cloudSync)
    .set({ ...patch, ...sealSecrets(patch), updatedAt: new Date() })
    .where(eq(cloudSync.id, 1))
}

/** Forgets the church (disconnecting), and the central versions with it. */
export async function clearCloudIdentity(): Promise<void> {
  await getDatabase().delete(cloudSync)
  clearSyncVersions()
}
