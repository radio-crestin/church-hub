import { getApiUrl } from '~/config'

/** Bytes per ranged request. Small enough to give frequent progress, big enough
 * to keep the number of round-trips low (an ~18MB file ≈ 9 requests). */
const CHUNK_SIZE = 2 * 1024 * 1024

/** Per-request timeout — a single chunk should arrive well within this. */
const REQUEST_TIMEOUT_MS = 60_000

type ProgressFn = (downloaded: number, total: number | null) => void

/**
 * Fetches one byte range through the server proxy. We always go via the proxy
 * (even in Tauri, where `getApiUrl()` points at the local sidecar) because the
 * Tauri HTTP plugin's direct streaming proved unreliable — it buffered the body
 * and the download sat at 0%. The proxy does the ranged fetch server-side, which
 * is verified to work, and it's the same path every other API call already uses.
 */
async function fetchRange(
  url: string,
  start: number,
  end: number,
): Promise<Response> {
  const headers = { Range: `bytes=${start}-${end}` }
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const base = getApiUrl() ?? ''
  const proxyUrl = `${base}/api/proxy/download?url=${encodeURIComponent(url)}`
  return fetch(proxyUrl, { method: 'GET', headers, signal })
}

/** Parses the total file size from Content-Range ("bytes a-b/total") or, failing
 * that, the (full) Content-Length / X-Content-Length headers. */
function parseTotalBytes(res: Response): number | null {
  const contentRange = res.headers.get('content-range')
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)\s*$/)
    if (match) return parseInt(match[1], 10)
  }
  const len =
    res.headers.get('content-length') || res.headers.get('x-content-length')
  return len ? parseInt(len, 10) : null
}

/** Fallback for servers that ignore Range (200 instead of 206): stream the whole
 * body, reporting progress per chunk. */
async function readWholeBody(
  res: Response,
  total: number | null,
  onProgress?: ProgressFn,
): Promise<ArrayBuffer> {
  const reader = res.body?.getReader()
  if (!reader) return res.arrayBuffer()

  const chunks: Uint8Array[] = []
  let downloaded = 0
  onProgress?.(0, total)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    downloaded += value.length
    onProgress?.(downloaded, total)
  }
  const out = new Uint8Array(downloaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out.buffer
}

/**
 * Downloads a file as an ArrayBuffer using HTTP Range requests so progress is
 * reliable — each chunk is a small, complete request that returns quickly, and
 * we report progress after every one. (Single-stream downloads proved
 * unreliable across the Tauri HTTP plugin and the Bun proxy: the body buffered
 * and the bar sat at 0% even though the source was fast.) Falls back to a plain
 * streamed read if the server doesn't honour ranges.
 */
export async function downloadFromUrl(
  url: string,
  onProgress?: ProgressFn,
): Promise<ArrayBuffer> {
  // First chunk — also tells us the total size and whether ranges are honoured.
  const first = await fetchRange(url, 0, CHUNK_SIZE - 1)
  if (!first.ok) {
    throw new Error(`Failed to download: ${first.status} ${first.statusText}`)
  }

  const total = parseTotalBytes(first)

  // No range support (full 200) or unknown size → stream the body we already got.
  if (first.status !== 206 || total == null) {
    return readWholeBody(first, total, onProgress)
  }

  const chunks: Uint8Array[] = []
  let downloaded = 0
  onProgress?.(0, total)

  const firstBuf = new Uint8Array(await first.arrayBuffer())
  chunks.push(firstBuf)
  downloaded += firstBuf.length
  onProgress?.(downloaded, total)

  while (downloaded < total) {
    const start = downloaded
    const end = Math.min(start + CHUNK_SIZE - 1, total - 1)
    const res = await fetchRange(url, start, end)
    if (!res.ok) {
      throw new Error(
        `Download failed at ${start} bytes: ${res.status} ${res.statusText}`,
      )
    }
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.length === 0) break // defensive: avoid an infinite loop
    chunks.push(buf)
    downloaded += buf.length
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
