import type { Context } from 'hono'
import { holdsHostKey } from './holdsHostKey'
import { isHostedRoom } from './isHostedRoom'
import { readHostKey } from './readHostKey'

/**
 * Null when the request may act as the room's host, else the refusal.
 *
 * A hosted room (see hostedRoomId) needs the host key its id comes from.
 * Any other room id is one the released apps make: those apps send no host
 * key, so such a room keeps working with its secret alone, as it always has.
 */
export async function authorizeHost(
  c: Context,
  secret: string
): Promise<Response | null> {
  if (!isHostedRoom(secret)) return null
  if (await holdsHostKey(secret, readHostKey(c))) return null
  c.header('WWW-Authenticate', 'Bearer')
  return c.json({ error: 'Host key required' }, 401)
}
