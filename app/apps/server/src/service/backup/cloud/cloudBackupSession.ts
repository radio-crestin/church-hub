import { CloudBackupError, signInRequired } from './CloudBackupError'
import {
  readCloudBackupCredential,
  saveCloudBackupCredential,
} from './cloudBackupCredential'
import { cloudBackupFetch } from './cloudBackupFetch'

/** The service's answer to a sign-in or a refresh. */
export interface ServiceSession {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
  refreshExpiresAt: number
  email: string
}

/** An access token is renewed this long before it expires. */
const RENEW_BEFORE_S = 60

/** The current access token, in memory only. */
let access: { token: string; expiresAt: number } | null = null
/**
 * The refresh in progress, shared by every caller meanwhile: refresh tokens
 * are single use, so a second refresh with the same token would look like
 * a stolen copy to the service and end every session of the account.
 */
let refreshing: Promise<{ serviceUrl: string; token: string }> | null = null

/** Keeps a new session: the refresh token in server_secrets, access in memory. */
export function keepServiceSession(
  serviceUrl: string,
  session: ServiceSession,
) {
  saveCloudBackupCredential({
    serviceUrl,
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.refreshExpiresAt,
    email: session.email,
  })
  access = { token: session.accessToken, expiresAt: session.accessExpiresAt }
}

/** Forgets this PC's sign-in (the service's tokens are not revoked here). */
export function forgetServiceSession(): void {
  access = null
  saveCloudBackupCredential(null)
}

/**
 * The service and a live access token for it, refreshed when needed (the
 * refresh token rotates and is saved again). A refresh the service refuses
 * signs this PC out: `cloud_sign_in_required`.
 */
export async function getCloudAccess(
  forceRefresh = false,
): Promise<{ serviceUrl: string; token: string }> {
  const credential = readCloudBackupCredential()
  if (!credential) throw signInRequired()
  const now = Math.floor(Date.now() / 1000)
  if (!forceRefresh && access && access.expiresAt - RENEW_BEFORE_S > now) {
    return { serviceUrl: credential.serviceUrl, token: access.token }
  }
  refreshing ??= refresh(
    credential.serviceUrl,
    credential.refreshToken,
  ).finally(() => {
    refreshing = null
  })
  return refreshing
}

async function refresh(serviceUrl: string, refreshToken: string) {
  try {
    const session = await cloudBackupFetch<ServiceSession>(
      serviceUrl,
      'POST',
      '/backup/session/refresh',
      { body: { refreshToken } },
    )
    keepServiceSession(serviceUrl, session)
    return { serviceUrl, token: session.accessToken }
  } catch (error) {
    if (error instanceof CloudBackupError && error.status === 401) {
      forgetServiceSession()
      throw signInRequired()
    }
    throw error
  }
}
