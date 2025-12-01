/**
 * Application configuration
 */

const API_HOST = import.meta.env.VITE_API_HOST || '127.0.0.1'
const API_PORT = import.meta.env.VITE_API_PORT || '3000'

/**
 * Returns the base API URL
 */
export function getApiUrl(): string {
  return `http://${API_HOST}:${API_PORT}`
}

/**
 * Returns the WebSocket URL
 */
export function getWsUrl(): string {
  return `ws://${API_HOST}:${API_PORT}`
}
