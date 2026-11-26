import {
  getCloudIdentity,
  saveCloudIdentity,
  updateCloudIdentity,
} from './cloudIdentityStore'
import { getSyncServiceUrl } from './getSyncServiceUrl'
import { requireOwnerSession } from './ownerSession'
import { setServerConflict } from './serverConflict'
import { serviceError, syncServiceRequest } from './syncServiceRequest'
import { runSyncCycle } from '../runSyncCycle'
import { upsertSyncConfig } from '../syncConfigStore'

/** A church server the signed-in owner owns, or is offered by a transfer. */
export interface OwnedChurch {
  churchId: string
  name: string
  role: 'owner' | 'pending'
  createdAt: number
  updatedAt: number
  serverLastSeenAt: number | null
  deviceCount: number
}

interface ServerCredentials {
  churchId: string
  deviceId: string
  serverToken: string
  readUrl: string
}

/** Where the owner's requests go: this PC's service, else the default. */
async function ownerTarget() {
  const session = requireOwnerSession()
  const identity = await getCloudIdentity()
  return {
    session,
    identity,
    target: {
      serviceUrl: identity?.serviceUrl ?? getSyncServiceUrl(),
      ownerTicket: session.ticket,
    },
  }
}

function churchPath(churchId: string, action: string): string {
  return `/owner/churches/${encodeURIComponent(churchId)}/${action}`
}

/** The church servers the signed-in owner owns or is offered. */
export async function listOwnerChurches(): Promise<{
  email: string
  churches: OwnedChurch[]
}> {
  const { target } = await ownerTarget()
  const response = await syncServiceRequest<{
    email: string
    churches: OwnedChurch[]
  }>(target, 'GET', '/owner/churches')
  if (response.status !== 200) throw serviceError(response)
  return { email: response.body.email, churches: response.body.churches }
}

/**
 * Recovers one of the owner's churches on this PC (a new or reinstalled
 * one): the service revokes the old server token and issues this PC a
 * fresh one with the current read path. The library then comes down on the
 * first cycle, matched to the rows this PC already has; nothing local is
 * uploaded wholesale.
 */
export async function recoverCloudChurch(
  churchId: string,
): Promise<{ churchId: string }> {
  const { session, identity, target } = await ownerTarget()
  if (identity && identity.churchId !== churchId) {
    throw new Error('already_connected')
  }
  const response = await syncServiceRequest<ServerCredentials>(
    target,
    'POST',
    churchPath(churchId, 'recover'),
  )
  if (response.status !== 200) throw serviceError(response)
  const { deviceId, serverToken, readUrl } = response.body
  await saveCloudIdentity({
    serviceUrl: target.serviceUrl,
    churchId,
    readUrl,
    deviceId,
    serverToken,
    ownerEmail: session.email,
  })
  setServerConflict(null)
  await upsertSyncConfig({
    transport: 'cloud',
    syncEnabled: true,
    lastError: null,
  })
  void runSyncCycle()
  return { churchId }
}

/**
 * Revokes every device of this PC's church, its own old token included,
 * and moves the church to a new path: phones must be paired again, and a
 * copied backup file opens nothing any more. This PC keeps syncing with the
 * fresh token the service issues it.
 */
export async function resetCloudChurch(): Promise<{ readUrl: string }> {
  const { identity, target } = await ownerTarget()
  if (!identity) throw new Error('not_connected')
  const response = await syncServiceRequest<ServerCredentials>(
    target,
    'POST',
    churchPath(identity.churchId, 'reset'),
  )
  if (response.status !== 200) throw serviceError(response)
  const { deviceId, serverToken, readUrl } = response.body
  await updateCloudIdentity({ deviceId, serverToken, readUrl, headEtag: null })
  setServerConflict(null)
  return { readUrl }
}

/** Offers a church to another Google account, which accepts it later. */
export async function transferCloudChurch(
  churchId: string,
  email: string,
): Promise<{ pendingOwnerEmail: string }> {
  const { target } = await ownerTarget()
  const response = await syncServiceRequest<{ pendingOwnerEmail: string }>(
    target,
    'POST',
    churchPath(churchId, 'transfer'),
    { email },
  )
  if (response.status !== 200) throw serviceError(response)
  return response.body
}

/** Accepts a church offered to the signed-in account: it becomes the owner. */
export async function acceptCloudChurch(
  churchId: string,
): Promise<{ email: string }> {
  const { identity, target } = await ownerTarget()
  const response = await syncServiceRequest<{ email: string }>(
    target,
    'POST',
    churchPath(churchId, 'accept'),
  )
  if (response.status !== 200) throw serviceError(response)
  if (identity?.churchId === churchId) {
    await updateCloudIdentity({ ownerEmail: response.body.email })
  }
  return response.body
}
