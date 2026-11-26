import { fetchJsonWithStatus } from '~/utils/fetcher'

/** A device of this church on the cloud sync service (server /api/sync/cloud). */
export interface CloudDevice {
  id: string
  name: string
  /** The account it writes as (null: this computer itself). */
  userId: number | null
  isServer: boolean
  /** Unix seconds. */
  createdAt: number
  revokedAt: number | null
}

export interface AddedCloudDevice {
  deviceId: string
  /** The link (and QR code) the device opens to join the church. */
  joinUrl: string
}

async function cloudRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const { status, body: json } = await fetchJsonWithStatus<{
    data?: T
    error?: string
  }>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Answered once the sync service has (a first connect registers too).
    timeout: 60_000,
  })
  if (status >= 400 || json.data === undefined) {
    throw new Error(json.error ?? `HTTP ${status}`)
  }
  return json.data
}

/** Registers this computer's church on the cloud sync service (as a guest). */
export function connectCloud(): Promise<{ churchId: string }> {
  return cloudRequest('/api/sync/cloud', 'POST', {})
}

export function listCloudDevices(): Promise<CloudDevice[]> {
  return cloudRequest('/api/sync/cloud/devices', 'GET')
}

/** Mints a device token for `userId`: the device joins with the link. */
export function addCloudDevice(input: {
  userId: number
  name: string
}): Promise<AddedCloudDevice> {
  return cloudRequest('/api/sync/cloud/devices', 'POST', input)
}

export function revokeCloudDevice(deviceId: string): Promise<unknown> {
  return cloudRequest(
    `/api/sync/cloud/devices/${encodeURIComponent(deviceId)}`,
    'DELETE',
  )
}
