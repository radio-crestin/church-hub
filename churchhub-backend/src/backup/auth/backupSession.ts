import { constantTimeEqual } from '../../utils/constantTimeEqual'
import { SyncError } from '../../sync/SyncError'
import { generateCodeChallenge } from '../../utils/pkce'
import { accountIdFor } from '../account/accountKeys'
import { readAccount } from '../account/accountStore'
import type { BackupSettings } from '../backupSettings'
import type { BackupBucket } from '../storage/createBackupBucket'
import {
  type BackupSession,
  type SessionTokenData,
  createSession,
  readAccessToken,
  readGrant,
  readRefreshToken,
} from './backupTokens'

const VERIFIER = /^[A-Za-z0-9_-]{43,128}$/

/** The signed-in account a request acts for. */
export interface BackupCaller {
  sub: string
  email: string
  accountId: string
}

const refused = () =>
  new SyncError(401, 'unauthorized', 'Sign in with Google again')

/** 401 unless the account still accepts tokens issued at `iat`. */
async function requireLiveToken(
  bucket: BackupBucket,
  settings: BackupSettings,
  token: SessionTokenData
): Promise<BackupCaller> {
  const accountId = await accountIdFor(token.sub, settings.keySecret)
  const { record } = await readAccount(bucket, accountId)
  if (token.iat <= record.tokensValidAfter) throw refused()
  return { sub: token.sub, email: token.email, accountId }
}

/**
 * The PC's first session after a sign-in: the grant from the callback and
 * the verifier whose hash the sign-in carried (constant-time compared).
 */
export async function openBackupSession(
  settings: BackupSettings,
  grant: unknown,
  verifier: unknown
): Promise<BackupSession> {
  const data = await readGrant(
    typeof grant === 'string' ? grant : null,
    settings.secret
  )
  if (!data || typeof verifier !== 'string' || !VERIFIER.test(verifier)) {
    throw refused()
  }
  if (!constantTimeEqual(await generateCodeChallenge(verifier), data.challenge)) {
    throw refused()
  }
  return createSession({ sub: data.sub, email: data.email }, settings.secret)
}

/** A new session for a refresh token the account still accepts. */
export async function refreshBackupSession(
  bucket: BackupBucket,
  settings: BackupSettings,
  refreshToken: unknown
): Promise<BackupSession> {
  const data = await readRefreshToken(
    typeof refreshToken === 'string' ? refreshToken : null,
    settings.secret
  )
  if (!data) throw refused()
  const caller = await requireLiveToken(bucket, settings, data)
  return createSession(caller, settings.secret)
}

/** The account behind `Authorization: Bearer chba_…`, or 401. */
export async function authenticateBackupCaller(
  bucket: BackupBucket,
  settings: BackupSettings,
  authorization: string | undefined
): Promise<BackupCaller> {
  const token = authorization?.match(/^Bearer\s+(chba_\S+)$/i)?.[1]
  const data = await readAccessToken(token, settings.secret)
  if (!data) throw refused()
  return requireLiveToken(bucket, settings, data)
}
