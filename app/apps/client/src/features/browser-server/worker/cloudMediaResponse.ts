import { getCloudIdentity } from '../../../../../server/src/service/sync/cloud/cloudIdentityStore'
import { createLogger } from '../../../../../server/src/utils/logger'

const logger = createLogger('cloud-media')

/** A gallery file, as the server's media route names it. */
const MEDIA_PATH = /^\/api\/media\/backgrounds\/([^/]+)$/
/** An index this recent answers a miss too; an older one is read again. */
const FRESH_MS = 10_000

interface MediaEntry {
  hash: string
  type: string
}

let index: {
  readUrl: string
  at: number
  media: Record<string, MediaEntry>
} | null = null

/** The church's media index (media/index.json, written by its PC). */
async function readIndex(readUrl: string): Promise<Record<string, MediaEntry>> {
  try {
    const response = await fetch(`${readUrl}/media/index.json`, {
      cache: 'no-cache',
    })
    if (!response.ok) throw new Error(`media index ${response.status}`)
    const { media } = (await response.json()) as {
      media: Record<string, MediaEntry>
    }
    index = { readUrl, at: Date.now(), media }
  } catch (error) {
    // Offline: the last index read, else nothing.
    logger.warning(`Media index unavailable: ${String(error)}`)
    if (index?.readUrl !== readUrl)
      index = { readUrl, at: Date.now(), media: {} }
  }
  return index?.media ?? {}
}

async function findMedia(readUrl: string, id: string) {
  const known = index?.readUrl === readUrl ? index.media[id] : undefined
  if (known) return known
  if (index?.readUrl === readUrl && Date.now() - index.at < FRESH_MS)
    return null
  return (await readIndex(readUrl))[id] ?? null
}

/** The media id a request asks for, when it reads a gallery file. */
export function cloudMediaId(url: URL, method: string): string | null {
  if (method !== 'GET' && method !== 'HEAD') return null
  return url.pathname.match(MEDIA_PATH)?.[1] ?? null
}

/**
 * A gallery file with the church PC out of reach: its copy in the church's
 * bucket (published by the PC, cloud-media), where the page loads it
 * itself (307 to it; the service worker keeps it). A file the PC hasn't
 * published (a video it keeps, one over the limits) is 404
 * `media_unavailable`, which the page shows as unavailable.
 */
export async function cloudMediaResponse(id: string): Promise<Response> {
  const identity = await getCloudIdentity()
  const entry = identity ? await findMedia(identity.readUrl, id) : null
  if (!identity || !entry) {
    return new Response(
      JSON.stringify({
        error: 'This file is on the church computer only',
        code: 'media_unavailable',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return new Response(null, {
    status: 307,
    headers: {
      Location: `${identity.readUrl}/media/${entry.hash}`,
      'X-Media-Type': entry.type,
    },
  })
}
