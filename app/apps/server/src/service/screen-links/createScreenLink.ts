import { SCREEN_LINK_PREFIX, SCREEN_LINK_TTL_MS } from './constants'
import { hashScreenLinkToken } from './hashScreenLinkToken'
import { readScreenLinks, writeScreenLinks } from './screenLinkStore'
import { toBase64Url } from './toBase64Url'
import type { ScreenLinkInfo } from './types'

/**
 * A new link to `screenId`: its token, shown once (in the link), and when it
 * expires. Only its hash is kept.
 */
export async function createScreenLink(
  screenId: number,
): Promise<ScreenLinkInfo & { token: string }> {
  const random = crypto.getRandomValues(new Uint8Array(32))
  const token = `${SCREEN_LINK_PREFIX}${toBase64Url(random)}`
  const createdAt = Date.now()
  const link = {
    id: crypto.randomUUID(),
    screenId,
    createdAt,
    expiresAt: createdAt + SCREEN_LINK_TTL_MS,
  }
  writeScreenLinks([
    ...readScreenLinks(),
    { ...link, tokenHash: await hashScreenLinkToken(token) },
  ])
  return { ...link, token }
}
