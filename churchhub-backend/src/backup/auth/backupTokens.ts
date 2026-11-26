import { createSignedToken, readSignedToken } from './signedToken'

/** A sign-in's grant: the PC swaps it (with its verifier) for a session. */
export const GRANT_TTL_SECONDS = 5 * 60
/** What every backup call carries. */
export const ACCESS_TTL_SECONDS = 60 * 60
/** What the PC keeps; each refresh hands out a new one. */
export const REFRESH_TTL_SECONDS = 180 * 24 * 60 * 60

/** The Google account a token stands for (verified by Google at sign-in). */
export interface BackupIdentity {
  sub: string
  /** Lowercased; shown in the app, never stored by the service. */
  email: string
}

export interface GrantData extends BackupIdentity {
  /** base64url SHA-256 of the PC's verifier. */
  challenge: string
  exp: number
}

export interface SessionTokenData extends BackupIdentity {
  /** Issued at, unix ms: compared with the account's tokensValidAfter. */
  iat: number
  /** The session family (one signed-in PC) in the account's record. */
  fid: string
  exp: number
}

export interface RefreshTokenData extends SessionTokenData {
  /** The family's generation it was issued for; single use. */
  gen: number
}

export interface BackupSession {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
  refreshExpiresAt: number
  email: string
}

const seconds = () => Math.floor(Date.now() / 1000)

export function createGrant(
  identity: BackupIdentity,
  challenge: string,
  secret: string
): Promise<string> {
  return createSignedToken(
    'chbg',
    { ...identity, challenge, exp: seconds() + GRANT_TTL_SECONDS },
    secret
  )
}

export const readGrant = (token: string | null | undefined, secret: string) =>
  readSignedToken<GrantData>('chbg', token, secret)

/**
 * A new access token and refresh token for one session family at one
 * generation (the account's record must already hold that generation).
 */
export async function createSession(
  identity: BackupIdentity,
  family: { fid: string; gen: number },
  secret: string
): Promise<BackupSession> {
  const iat = Date.now()
  const now = seconds()
  const accessExpiresAt = now + ACCESS_TTL_SECONDS
  const refreshExpiresAt = now + REFRESH_TTL_SECONDS
  const data = { sub: identity.sub, email: identity.email, iat, fid: family.fid }
  return {
    accessToken: await createSignedToken(
      'chba',
      { ...data, exp: accessExpiresAt },
      secret
    ),
    accessExpiresAt,
    refreshToken: await createSignedToken(
      'chbr',
      { ...data, gen: family.gen, exp: refreshExpiresAt },
      secret
    ),
    refreshExpiresAt,
    email: identity.email,
  }
}

export const readAccessToken = (
  token: string | null | undefined,
  secret: string
) => readSignedToken<SessionTokenData>('chba', token, secret)

export const readRefreshToken = (
  token: string | null | undefined,
  secret: string
) => readSignedToken<RefreshTokenData>('chbr', token, secret)
