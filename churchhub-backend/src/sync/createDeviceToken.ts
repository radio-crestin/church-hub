import { hashToken } from './hashToken'
import { randomId } from './randomId'

/** A new bearer token and the hash the central state keeps of it. */
export async function createDeviceToken(
  secret: string
): Promise<{ token: string; tokenHash: string }> {
  const token = `chs_${randomId(32)}`
  return { token, tokenHash: await hashToken(token, secret) }
}
