import { bytesToBase64url } from '../../sync/owner/base64url'

/** The version every backup names in its header; a rotation would add v2. */
export const ACCOUNT_KEY_VERSION = 1

/**
 * The account's key (256 bits, base64url): HKDF-SHA-256 of
 * BACKUP_KEY_SECRET with the account's Google `sub` in its info. The app
 * wraps each backup's own random key with it, so the same account can
 * restore after a reinstall by signing in again, while the bucket alone
 * (without this secret) can't read a backup.
 */
export async function deriveAccountKey(
  googleSub: string,
  keySecret: string
): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keySecret),
    'HKDF',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode(
        `church-hub-backup-account-key-v${ACCOUNT_KEY_VERSION}:${googleSub}`
      ),
    },
    material,
    256
  )
  return bytesToBase64url(new Uint8Array(bits))
}
