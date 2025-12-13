import { ClientOptions, fetch as tauriFetch } from '@tauri-apps/plugin-http'

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch in Tauri mode, browser fetch in web mode
const fetchFn = isTauri ? tauriFetch : window.fetch.bind(window)

/**
 * Gets the API base URL using the same hostname the client accessed from
 */
function getApiBaseUrl(): string {
  const port =
    window.__serverConfig?.serverPort ??
    import.meta.env.VITE_SERVER_PORT ??
    3000

  // Use the same hostname the client used to access the app
  const hostname =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'localhost'

  return `http://${hostname}:${port}`
}

export async function fetcher<T>(
  url: string,
  options?: RequestInit & ClientOptions,
): Promise<T> {
  const res = await fetchFn(`${getApiBaseUrl()}${url}`, {
    ...(options ?? {}),
    headers: {
      Authorization: `Bearer ${window.__serverConfig?.authToken}`, // Not required for dev
      ...(options?.headers ?? {}),
    },
  })
  return await res.json()
}
