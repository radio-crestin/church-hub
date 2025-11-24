import { ClientOptions, fetch as tauriFetch } from '@tauri-apps/plugin-http'

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch in Tauri mode, browser fetch in web mode
const fetchFn = isTauri ? tauriFetch : window.fetch.bind(window)

export async function fetcher<T>(
  url: string,
  options?: RequestInit & ClientOptions,
): Promise<T> {
  const PORT =
    window.__serverConfig?.serverPort ??
    import.meta.env.VITE_SERVER_PORT ??
    3000
  const res = await fetchFn(`http://localhost:${PORT}${url}`, {
    ...(options ?? {}),
    headers: {
      Authorization: `Bearer ${window.__serverConfig?.authToken}`, // Not required for dev
      ...(options?.headers ?? {}),
    },
  })
  return await res.json()
}
