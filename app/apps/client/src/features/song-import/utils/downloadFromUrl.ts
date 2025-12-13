import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const fetchFn = isTauri ? tauriFetch : window.fetch.bind(window)

/**
 * Downloads a file from a URL and returns it as an ArrayBuffer
 */
export async function downloadFromUrl(
  url: string,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const response = await fetchFn(url, {
    method: 'GET',
    redirect: 'follow',
  })

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
