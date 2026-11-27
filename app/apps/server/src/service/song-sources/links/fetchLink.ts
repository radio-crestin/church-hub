import { DownloadError } from './DownloadError'
import { requestOnce } from './requestOnce'
import { requireLinkUrl } from './requireLinkUrl'
import { createLogger } from '../../../utils/logger'
import { readBundledLibraryFile } from '../featured/readBundledLibraryFile'

const logger = createLogger('song-sources')

const MAX_REDIRECTS = 5

/**
 * Downloads a link's bytes. Redirects are followed by hand so every
 * hop is checked like the link itself: https, and connected only to a
 * public address (see requestOnce). Throws a DownloadError with the HTTP status on failure.
 */
async function download(link: string): Promise<Uint8Array> {
  let url = requireLinkUrl(link)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await requestOnce(url)
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = requireLinkUrl(new URL(response.location, url).toString())
      continue
    }
    if (response.status < 200 || response.status >= 300) {
      throw new DownloadError(response.status, url)
    }
    return response.body
  }
  throw new Error(`Too many redirects: ${link}`)
}

/**
 * Downloads a shared link's bytes (see download). With no connection, a
 * featured library's file the installer shipped is read instead, so its
 * songs can be imported offline; an HTTP refusal is never replaced.
 */
export async function fetchLink(link: string): Promise<Uint8Array> {
  try {
    return await download(link)
  } catch (error) {
    if (error instanceof DownloadError) throw error
    const bundled = readBundledLibraryFile(link)
    if (!bundled) throw error
    logger.info(`Offline (${error}): reading the installer's copy of ${link}`)
    return bundled
  }
}
