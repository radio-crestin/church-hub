import { hashToken } from '../../sync/hashToken'
import { constantTimeEqual } from '../../utils/constantTimeEqual'
import { fromBase64url, toBase64url } from '../../sync/owner/base64url'

/** Each kind of backup token: its prefix, also what its signature covers. */
export type TokenKind = 'chba' | 'chbr' | 'chbg'

const sign = (kind: TokenKind, payload: string, secret: string) =>
  hashToken(`${kind}:${payload}`, secret)

/** `<kind>_<base64url JSON>.<HMAC-SHA-256 hex>`, signed with BACKUP_SECRET. */
export async function createSignedToken(
  kind: TokenKind,
  data: object,
  secret: string
): Promise<string> {
  const payload = toBase64url(JSON.stringify(data))
  return `${kind}_${payload}.${await sign(kind, payload, secret)}`
}

/**
 * The token's data when its kind and signature check out (compared in
 * constant time) and it has not expired (`exp`, unix seconds); else null.
 */
export async function readSignedToken<T extends { exp: number }>(
  kind: TokenKind,
  token: string | null | undefined,
  secret: string
): Promise<T | null> {
  const match = token?.match(/^([a-z]{4})_([A-Za-z0-9_-]{1,4096})\.([0-9a-f]{64})$/)
  if (!match || match[1] !== kind) return null
  const [, , payload, signature] = match
  if (!constantTimeEqual(signature, await sign(kind, payload, secret))) {
    return null
  }
  const data = JSON.parse(fromBase64url(payload)) as T
  if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) {
    return null
  }
  return data
}
