/**
 * The origins of the app's own webviews, which call this server
 * cross-origin: `tauri://localhost` on macOS, iOS and Linux;
 * `http://tauri.localhost` on Windows and Android (`https://` when the
 * shell is built with `useHttpsScheme`). The phone apps' Tauri HTTP plugin
 * sends the same origin with every request it makes.
 */
const APP_WEBVIEW_ORIGINS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
])

export function isAppWebviewOrigin(origin: string): boolean {
  return APP_WEBVIEW_ORIGINS.has(origin.toLowerCase())
}
