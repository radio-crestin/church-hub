import { churchPrefix } from '../churchPrefix'
import { createDeviceToken } from '../createDeviceToken'
import { randomId } from '../randomId'
import { rotatePath } from '../rotatePath'
import type { SyncStore } from '../state/ChurchState'
import { updateChurch } from '../state/updateChurch'
import type { Installation } from '../checkInstallation'
import type { OwnerIdentity } from './OwnerIdentity'
import { requireOwner } from './requireOwner'

export interface ServerCredentials {
  churchId: string
  deviceId: string
  /** The new church server token; shown once, only its hash is kept. */
  serverToken: string
  pathSecret: string
  readUrl: string
}

/**
 * The owner moves the church server to the PC they are on: the old server
 * token is revoked and a fresh one is issued to this installation, which
 * then reads the church from its current path (recovery on a new or
 * reinstalled PC). `revokeAll` also revokes every other device and rotates
 * the path, so nothing that held a token or the old path (a lost phone, a
 * copied backup file) can read or write any more.
 */
export async function replaceServer(
  store: SyncStore,
  churchId: string,
  owner: OwnerIdentity,
  installation: Installation,
  revokeAll: boolean
): Promise<ServerCredentials> {
  const deviceId = randomId(12)
  const { token, tokenHash } = await createDeviceToken(store.secret)
  let { state } = await updateChurch(store, churchId, async (church) => {
    requireOwner(church, owner)
    const now = Math.floor(Date.now() / 1000)
    for (const device of church.devices) {
      if (device.revokedAt === null && (revokeAll || device.isServer)) {
        device.revokedAt = now
      }
    }
    church.devices.push({
      id: deviceId,
      tokenHash,
      userId: null,
      name: installation.name ?? 'Church server',
      isServer: true,
      createdAt: now,
      revokedAt: null,
      installationId: installation.id,
      installationName: installation.name,
      lastSeenAt: now,
    })
    church.updatedAt = now
    return { next: church, result: deviceId }
  })
  if (revokeAll) state = await rotatePath(store, churchId)
  return {
    churchId,
    deviceId,
    serverToken: token,
    pathSecret: state.pathSecret,
    readUrl: store.bucket.publicUrl(churchPrefix(churchId, state.pathSecret)),
  }
}
