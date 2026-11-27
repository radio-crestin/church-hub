import { getExternalInterfaces } from '../network/getExternalInterfaces'
import { getRemoteAccessSettings } from '../remote-access'
import { getSignalingBaseUrl } from '../signaling/signalingBaseUrl'
import { getPublicAppUrl } from '../sync/cloud/getPublicAppUrl'
import { getServerPort } from '../../utils/serverPort'

/** Where another device reaches this PC's screens by a link (T-214). */
export interface ScreenLinkEndpoints {
  /**
   * Over the internet (the default): the public web app, connecting to
   * this PC over WebRTC in its remote access room. Null while remote access
   * is off.
   */
  internet: { publicAppUrl: string; relay: string; room: string } | null
  /** Directly on the church network: this PC's LAN addresses and port. */
  network: { addresses: string[]; port: number }
}

export function describeScreenLinkEndpoints(): ScreenLinkEndpoints {
  const { enabled, secret } = getRemoteAccessSettings()
  return {
    internet: enabled
      ? {
          publicAppUrl: getPublicAppUrl(),
          relay: getSignalingBaseUrl(),
          room: secret,
        }
      : null,
    network: {
      addresses: getExternalInterfaces().map(({ address }) => address),
      port: getServerPort(),
    },
  }
}
