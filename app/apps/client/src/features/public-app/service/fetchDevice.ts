import { DeviceRefusedError } from './fetchReadUrl'

const TIMEOUT_MS = 15_000

/** This device on the sync service, and the user its token is for. */
export interface CloudDevice {
  deviceId: string
  userId: string
}

/**
 * Asks the sync service whose device this token is
 * (`GET /sync/churches/:id/device`): the browser signs in as that user when
 * it runs the church's server itself. A 401 means it was revoked.
 */
export async function fetchDevice(input: {
  serviceUrl: string
  churchId: string
  token: string
}): Promise<CloudDevice> {
  const response = await fetch(
    `${input.serviceUrl}/sync/churches/${encodeURIComponent(input.churchId)}/device`,
    {
      headers: { Authorization: `Bearer ${input.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  )
  if (response.status === 401) throw new DeviceRefusedError()
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const { deviceId, userId } = (await response.json()) as {
    deviceId: string
    userId: string | null
  }
  if (!userId) throw new DeviceRefusedError()
  return { deviceId, userId }
}
