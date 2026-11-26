/** A link another device shows a screen through (T-214). */
export interface ScreenLink {
  id: string
  /** The screen it shows. */
  screenId: number
  /** SHA-256 of its token (base64url): the token itself is never kept. */
  tokenHash: string
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms: past it the link is refused. */
  expiresAt: number
}

/** A link as listed: no hash. */
export type ScreenLinkInfo = Omit<ScreenLink, 'tokenHash'>
