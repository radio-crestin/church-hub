import { getBackendBaseUrl } from '../backend'

/**
 * The church's signaling relay (churchhub-backend's /signal routes): live
 * translation's listeners and the phones' remote access find this computer
 * there, and it goes in their pairing codes and listener links.
 * CHURCH_HUB_SIGNALING_URL points tests and development at a local stand-in.
 */
export function getSignalingBaseUrl(): string {
  return (process.env.CHURCH_HUB_SIGNALING_URL || getBackendBaseUrl()).replace(
    /\/+$/,
    '',
  )
}
