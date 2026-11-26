import { constantTimeEqual } from '../utils/constantTimeEqual'
import { HOST_KEY_PATTERN } from './constants'
import { hostedRoomId } from './hostedRoomId'

/** Whether `hostKey` is the key the hosted room's id comes from, in constant time. */
export async function holdsHostKey(
  secret: string,
  hostKey: string | null
): Promise<boolean> {
  if (hostKey === null || !HOST_KEY_PATTERN.test(hostKey)) return false
  return constantTimeEqual(await hostedRoomId(hostKey), secret)
}
