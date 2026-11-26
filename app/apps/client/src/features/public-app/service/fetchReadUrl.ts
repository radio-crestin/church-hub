/** The service no longer knows this device: revoked, or a bad link. */
export class DeviceRefusedError extends Error {
  constructor() {
    super('device_refused')
  }
}

const TIMEOUT_MS = 15_000

/**
 * Asks the sync service, with the device token, where the church is read
 * from now (`GET /sync/churches/:id/path`): it moves when a device is
 * revoked. A 401 means this device was revoked (DeviceRefusedError).
 */
export async function fetchReadUrl(input: {
  serviceUrl: string
  churchId: string
  token: string
}): Promise<string> {
  const response = await fetch(
    `${input.serviceUrl}/sync/churches/${encodeURIComponent(input.churchId)}/path`,
    {
      headers: { Authorization: `Bearer ${input.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  )
  if (response.status === 401) throw new DeviceRefusedError()
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const { readUrl } = (await response.json()) as { readUrl: string }
  return readUrl
}
