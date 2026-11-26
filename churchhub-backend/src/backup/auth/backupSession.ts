import { randomId } from '../../sync/randomId'
import { SyncError } from '../../sync/SyncError'
import { constantTimeEqual } from '../../utils/constantTimeEqual'
import { generateCodeChallenge } from '../../utils/pkce'
import type { AccountRecord } from '../account/AccountRecord'
import { updateAccountIndex } from '../account/accountIndex'
import { accountIdFor } from '../account/accountKeys'
import { readAccount, updateAccount } from '../account/accountStore'
import { applyTombstone, readTombstone } from '../account/tombstone'
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
/** Signed-in PCs an account keeps; the least recently used goes first. */
const MAX_SESSIONS = 10

/** The signed-in account a request acts for, and its session family. */
export interface BackupCaller {
  sub: string
  email: string
  accountId: string
  fid: string
}

const refused = () =>
  new SyncError(401, 'unauthorized', 'Sign in with Google again')

/** True while the account still accepts this token: not cut off, family alive. */
const isLive = (record: AccountRecord, token: SessionTokenData) =>
  token.iat > record.tokensValidAfter && token.fid in record.sessions

/** Ends every session of the account (sign-out everywhere, theft, deletion). */
export function revokeAllSessions(record: AccountRecord, now = Date.now()) {
  record.tokensValidAfter = now
  record.sessions = {}
}

function dropOldestSessions(record: AccountRecord) {
  const families = Object.entries(record.sessions).sort(
    ([, a], [, b]) => b.lastUsedAt - a.lastUsedAt
  )
  record.sessions = Object.fromEntries(families.slice(0, MAX_SESSIONS))
}

/**
 * The PC's first session after a sign-in: the grant from the callback and
 * the verifier whose hash the sign-in carried (constant-time compared).
 * Records a new session family, the account's email and sign-in time, and
 * its entry in the admin index; an account deleted before takes back the
 * limits its tombstone kept.
 */
export async function openBackupSession(
  bucket: BackupBucket,
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
  const accountId = await accountIdFor(data.sub, settings.keySecret)
  const fid = randomId(12)
  const now = Date.now()
  const record = await updateAccount(bucket, accountId, async (record) => {
    if (record.deletingSince !== null) {
      throw new SyncError(409, 'account_deleting', 'The account is being deleted; try again in a moment')
    }
    // A new record of an account deleted before takes its limits back. The
    // tombstone is read here, on every compare-and-swap attempt, so a
    // deletion that lands meanwhile is never missed; it stays until purged,
    // so two sign-ins at once both find it.
    if (record.createdAt === null) {
      const tombstone = await readTombstone(bucket, accountId)
      if (tombstone) applyTombstone(record, tombstone, now)
    }
    record.sessions[fid] = { generation: 0, createdAt: now, lastUsedAt: now }
    dropOldestSessions(record)
    record.email = data.email
    record.createdAt ??= now
    record.lastSignInAt = now
    return record
  })
  await updateAccountIndex(bucket, (index) => {
    index[accountId] = {
      email: data.email,
      createdAt: record.createdAt ?? now,
      lastSignInAt: now,
    }
  })
  return createSession(data, { fid, gen: 0 }, settings.secret)
}

/**
 * A new session for a refresh token, which is single use: its family moves
 * to the next generation. A token of an older generation was copied and
 * used before (theft): every session of the account ends, and it is 401.
 */
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
  const accountId = await accountIdFor(data.sub, settings.keySecret)
  const outcome = await updateAccount(bucket, accountId, (record) => {
    if (!isLive(record, data)) return 'refused' as const
    const family = record.sessions[data.fid]
    if (family.generation !== data.gen) {
      revokeAllSessions(record)
      return 'reused' as const
    }
    family.generation += 1
    family.lastUsedAt = Date.now()
    return family.generation
  })
  if (outcome === 'reused') {
    console.warn('[backup] a refresh token was used twice: every session ended')
  }
  if (typeof outcome !== 'number') throw refused()
  return createSession(data, { fid: data.fid, gen: outcome }, settings.secret)
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
  const accountId = await accountIdFor(data.sub, settings.keySecret)
  const { record } = await readAccount(bucket, accountId)
  if (!isLive(record, data)) throw refused()
  return { sub: data.sub, email: data.email, accountId, fid: data.fid }
}
