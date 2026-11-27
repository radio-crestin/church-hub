import { SCREEN_LINK_PREFIX } from './constants'
import { hashScreenLinkToken } from './hashScreenLinkToken'
import { readScreenLinks } from './screenLinkStore'
import type { ScreenLink } from './types'

/** The standing link a token opens, or null (not one, revoked, expired). */
export async function findScreenLink(
  token: string,
): Promise<ScreenLink | null> {
  if (!token.startsWith(SCREEN_LINK_PREFIX)) return null
  const hash = await hashScreenLinkToken(token)
  return readScreenLinks().find((link) => link.tokenHash === hash) ?? null
}
