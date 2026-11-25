/**
 * Whether the phone reaches the computer over its WebRTC tunnel right now
 * (installTunnel): then window.fetch and WebSocket carry its traffic, not
 * Tauri's HTTP and WebSocket plugins.
 */
let open = false

export function isTunnelOpen(): boolean {
  return open
}

export function setTunnelOpen(value: boolean) {
  open = value
}
