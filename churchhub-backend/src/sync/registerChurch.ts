import type { Installation } from './checkInstallation'
import { churchPrefix } from './churchPrefix'
import { createDeviceToken } from './createDeviceToken'
import { addOwnerMarker } from './owner/ownerIndex'
import type { OwnerIdentity } from './owner/OwnerIdentity'
import { publishHead } from './publishHead'
import { randomId } from './randomId'
import type { ChurchState, SyncStore } from './state/ChurchState'
import { writeChurch } from './state/writeChurch'

export interface RegisteredChurch {
  churchId: string
  pathSecret: string
  /** Public base URL of the church's prefix: readers GET `<readUrl>/head.json`. */
  readUrl: string
  deviceId: string
  /** The church server's token; shown once, only its hash is kept. */
  serverToken: string
  /** The owner's email, when registered signed in with Google. */
  ownerEmail: string | null
}

/**
 * Registers a church server: a church id, a 256-bit path secret, the
 * server's device token, and an empty head.json readers can poll at once.
 * Signed in with Google, the account owns it; as a guest nobody does until
 * it is claimed (claimChurch).
 */
export async function registerChurch(
  store: SyncStore,
  serverName: string,
  owner: OwnerIdentity | null = null,
  installation: Installation | null = null
): Promise<RegisteredChurch> {
  const churchId = randomId(12)
  const deviceId = randomId(12)
  const { token, tokenHash } = await createDeviceToken(store.secret)
  const now = Math.floor(Date.now() / 1000)
  const state: ChurchState = {
    schemaVersion: 1,
    id: churchId,
    pathSecret: randomId(32),
    seq: 0,
    snapshot: null,
    segments: [],
    devices: [
      {
        id: deviceId,
        tokenHash,
        userId: null,
        name: serverName,
        isServer: true,
        createdAt: now,
        revokedAt: null,
        installationId: installation?.id ?? null,
        installationName: installation?.name ?? null,
        lastSeenAt: installation ? now : null,
      },
    ],
    roles: [],
    users: [],
    versions: {},
    owner: owner && { ...owner, claimedAt: now },
    pendingOwnerEmail: null,
    createdAt: now,
    updatedAt: now,
  }

  const etag = await writeChurch(store, state, null)
  if (etag === null) throw new Error(`Church id ${churchId} already exists`)
  await publishHead(store, state, etag)
  if (owner) await addOwnerMarker(store, owner.email, churchId)

  return {
    churchId,
    pathSecret: state.pathSecret,
    readUrl: store.bucket.publicUrl(churchPrefix(churchId, state.pathSecret)),
    deviceId,
    serverToken: token,
    ownerEmail: owner?.email ?? null,
  }
}
