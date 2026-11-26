import { getServerPort } from '../../../utils/serverPort'

/**
 * Whether an Origin is this app's own UI: this server on loopback (the
 * browser and dev UI, same port) or the desktop webview (`tauri://localhost`
 * on macOS and Linux, `http(s)://tauri.localhost` on Windows). Any other
 * page, a different localhost port included, is not.
 */
export function isAppOrigin(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.protocol === 'tauri:') return url.hostname === 'localhost'
  if (url.hostname === 'tauri.localhost') return true
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  return (
    url.protocol === 'http:' && loopback && url.port === String(getServerPort())
  )
}
