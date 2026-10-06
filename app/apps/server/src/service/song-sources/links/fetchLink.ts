import { requireLinkUrl } from './requireLinkUrl'

const TIMEOUT_MS = 60_000

/** Downloads a shared link's bytes; throws with the HTTP status on failure. */
export async function fetchLink(url: string): Promise<Uint8Array> {
  const response = await fetch(requireLinkUrl(url), {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${url}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
