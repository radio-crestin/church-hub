import { assertPublicUrl } from './assertPublicUrl'

const TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 5

/**
 * Downloads a shared link's bytes. Redirects are followed by hand so every
 * hop is checked like the link itself (https, public address); throws with
 * the HTTP status on failure.
 */
export async function fetchLink(link: string): Promise<Uint8Array> {
  let url = await assertPublicUrl(link)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url))
      continue
    }
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${url}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }
  throw new Error(`Too many redirects: ${link}`)
}
