import { requestOnce } from './requestOnce'
import { requireLinkUrl } from './requireLinkUrl'

const MAX_REDIRECTS = 5

/**
 * Downloads a shared link's bytes. Redirects are followed by hand so every
 * hop is checked like the link itself: https, and connected only to a
 * public address (see requestOnce). Throws with the HTTP status on failure.
 */
export async function fetchLink(link: string): Promise<Uint8Array> {
  let url = requireLinkUrl(link)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await requestOnce(url)
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = requireLinkUrl(new URL(response.location, url).toString())
      continue
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Download failed: ${response.status} ${url}`)
    }
    return response.body
  }
  throw new Error(`Too many redirects: ${link}`)
}
