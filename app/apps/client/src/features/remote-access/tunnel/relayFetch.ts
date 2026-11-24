import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { isMobile, isTauri } from '~/config'

/**
 * fetch for the signaling relay. The phone app goes through Tauri's HTTP
 * client: the relay's CORS list doesn't know the app's origin.
 */
export function relayFetch(url: string, init?: RequestInit): Promise<Response> {
  return isTauri() && isMobile()
    ? tauriFetch(url, init)
    : window.fetch(url, init)
}
