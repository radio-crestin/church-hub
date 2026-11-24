import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { isMobile, isTauri } from '~/config'
import { isTunnelOpen } from '~/features/remote-access/tunnel/tunnelState'

/**
 * fetch for the Church Hub server. The phone app uses Tauri's HTTP client
 * (iOS WKWebView blocks plain-http fetches) unless its WebRTC tunnel is open,
 * which carries window.fetch; everywhere else window.fetch, which the
 * desktop app's webview shares its cookies with. Chosen at each call, so the
 * tunnel can take over after start-up.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri() && isMobile() && !isTunnelOpen()) return tauriFetch(input, init)
  return window.fetch(input, init)
}
