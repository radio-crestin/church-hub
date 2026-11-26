import { buildJoinUrl } from './buildJoinUrl'
import {
  type CloudIdentity,
  getCloudIdentity,
  updateCloudIdentity,
} from './cloudIdentityStore'
import { serviceError, syncServiceRequest } from './syncServiceRequest'
import { getUserUuid } from '../../users/getUserUuid'
import { idByUuid } from '../records/idByUuid'
import { runSyncCycle } from '../runSyncCycle'

async function requireIdentity(): Promise<CloudIdentity> {
  const identity = await getCloudIdentity()
  if (!identity) throw new Error('not_connected')
  return identity
}

async function mintDevice(
  identity: CloudIdentity,
  userUuid: string,
  name: string,
) {
  return syncServiceRequest<{
    deviceId: string
    token: string
  }>({ serviceUrl: identity.serviceUrl, identity }, 'POST', '/devices', {
    userId: userUuid,
    name,
  })
}

/**
 * Mints a device token for one of this server's users, so a phone writes
 * with their permissions (the join link of T-168 carries it). A user the
 * service doesn't know yet (added a moment ago) is synced first.
 */
export async function addCloudDevice(input: {
  userId: number
  name: string
}): Promise<{
  deviceId: string
  token: string
  churchId: string
  readUrl: string
  joinUrl: string
}> {
  const identity = await requireIdentity()
  const userUuid = getUserUuid(input.userId)
  if (!userUuid) throw new Error('unknown_user')
  let response = await mintDevice(identity, userUuid, input.name)
  if (response.status === 400 && response.body.code === 'unknown_user') {
    await runSyncCycle()
    response = await mintDevice(identity, userUuid, input.name)
  }
  if (response.status !== 201) throw serviceError(response)
  return {
    ...response.body,
    churchId: identity.churchId,
    readUrl: identity.readUrl,
    joinUrl: buildJoinUrl({
      readUrl: identity.readUrl,
      token: response.body.token,
      serviceUrl: identity.serviceUrl,
    }),
  }
}

export interface CloudDevice {
  id: string
  name: string
  /** This server's user the device writes as (null: the server itself). */
  userId: number | null
  isServer: boolean
  /** Unix seconds. */
  createdAt: number
  revokedAt: number | null
}

/** The church's devices on the sync service, newest first. */
export async function listCloudDevices(): Promise<CloudDevice[]> {
  const identity = await requireIdentity()
  const response = await syncServiceRequest<{
    devices: (Omit<CloudDevice, 'userId'> & { userId: string | null })[]
  }>({ serviceUrl: identity.serviceUrl, identity }, 'GET', '/devices')
  if (response.status !== 200) throw serviceError(response)
  return response.body.devices.map((device) => ({
    ...device,
    userId: device.userId === null ? null : idByUuid('users', device.userId),
  }))
}

/**
 * Revokes a device: the service refuses its writes and moves the church to
 * a new read path, which this server keeps at once.
 */
export async function revokeCloudDevice(
  deviceId: string,
): Promise<{ readUrl: string }> {
  const identity = await requireIdentity()
  const response = await syncServiceRequest<{ readUrl: string }>(
    { serviceUrl: identity.serviceUrl, identity },
    'DELETE',
    `/devices/${encodeURIComponent(deviceId)}`,
  )
  if (response.status !== 200) throw serviceError(response)
  await updateCloudIdentity({ readUrl: response.body.readUrl, headEtag: null })
  return { readUrl: response.body.readUrl }
}
