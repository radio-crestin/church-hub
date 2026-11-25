import type { DeviceRecord, SyncStore } from './state/ChurchState'
import type { ChurchVersion } from './state/readChurch'
import { updateChurch } from './state/updateChurch'
import { SyncError } from './SyncError'
import type { SyncCaller } from './types'

/** The server's last-seen time is rewritten at most this often. */
const SEEN_EVERY_SECONDS = 10 * 60

/** 409 server_in_use when another installation holds the token. */
function refuseOtherInstallation(
  server: DeviceRecord,
  installation: Installation,
  takeover: boolean
): void {
  if (takeover || !server.installationId) return
  if (server.installationId === installation.id) return
  throw new SyncError(
    409,
    'server_in_use',
    'Another PC keeps this church server',
    {
      otherPc: {
        name: server.installationName ?? null,
        lastSeenAt: server.lastSeenAt ?? null,
      },
    }
  )
}

export interface Installation {
  id: string
  name: string | null
}

/**
 * The church server's token can sit on two PCs at once (a local backup
 * restored on another PC carries it). Each PC names its installation; the
 * service remembers which one holds the token, and refuses the other with
 * 409 `server_in_use` (who holds it, and when it was last seen) until the
 * user picks it (`takeover`). Without a name (an app before T-172) nothing
 * is checked. Returns the church as it is after any bookkeeping write.
 */
export async function checkInstallation(
  store: SyncStore,
  church: ChurchVersion,
  who: SyncCaller,
  installation: Installation | null,
  takeover = false
): Promise<ChurchVersion> {
  if (!who.isServer || !installation) return church
  const now = Math.floor(Date.now() / 1000)
  const server = church.state.devices.find(
    (device) => device.id === who.deviceId
  )
  if (!server) return church
  refuseOtherInstallation(server, installation, takeover)
  const sameInstallation = server.installationId === installation.id
  const fresh =
    sameInstallation && now - (server.lastSeenAt ?? 0) < SEEN_EVERY_SECONDS
  if (fresh && !takeover) return church

  const { state, etag } = await updateChurch(
    store,
    church.state.id,
    async (next) => {
      const device = next.devices.find((d) => d.id === who.deviceId)
      if (!device) return null
      refuseOtherInstallation(device, installation, takeover)
      device.installationId = installation.id
      device.installationName = installation.name
      device.lastSeenAt = now
      return { next, result: device.id }
    },
    church
  )
  return { state, etag }
}
