import { createHash } from 'node:crypto'

import type { Database } from 'bun:sqlite'
import { generateSystemToken } from '../../app-sessions'
import { generateUserToken } from '../../users/users'
import { sealSecret } from '../sealSecret'
import { secretPlaces } from '../secretPlaces'

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

/**
 * A user whose token can't be opened gets a new one: its devices sign in
 * again (the old token's hash goes with it) and the QR code shows the new
 * one.
 */
export function renewUserToken(db: Database, rowid: number): void {
  const token = generateUserToken()
  const tokenHash = sha256(token)
  db.run('UPDATE users SET token = ?, token_hash = ? WHERE rowid = ?', [
    sealSecret(token, secretPlaces.userToken(tokenHash)),
    tokenHash,
    rowid,
  ])
}

/** The system API token, renewed the same way; its callers fetch it anew. */
export function renewSystemToken(db: Database, rowid: number, name: string) {
  const token = generateSystemToken()
  db.run(
    'UPDATE app_sessions SET session_token = ?, session_token_hash = ? WHERE rowid = ?',
    [sealSecret(token, secretPlaces.systemToken(name)), sha256(token), rowid],
  )
}
