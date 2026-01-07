/**
 * Check if the app is running in a Tauri environment
 */
export function isTauri(): boolean {
  return '__TAURI__' in window
}
