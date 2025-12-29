import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl } from '~/config'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Downloads a file from a URL and returns it as an ArrayBuffer
 * Uses Tauri fetch when available (no CORS), otherwise proxies through the server
 */
export async function downloadFromUrl(
  url: string,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  let response: Response

  if (isTauri) {
    // Tauri mode: direct fetch (no CORS issues)
    response = await tauriFetch(url, {
      method: 'GET',
      redirect: 'follow',
    })
  } else {
    // Browser mode: use server proxy to bypass CORS
    const proxyUrl = `${getApiUrl()}/api/proxy/download?url=${encodeURIComponent(url)}`
    response = await fetch(proxyUrl, {
      method: 'GET',
    })
  }

  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`,
    )
  }

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : null

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response reader')
  }

  const chunks: Uint8Array[] = []
  let downloaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    downloaded += value.length
    onProgress?.(downloaded, total)
  }

  const result = new Uint8Array(downloaded)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result.buffer
}
