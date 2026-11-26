import { createHash, randomBytes } from 'node:crypto'

/**
 * A new host key: 256 random bits, base64url. It stays on this computer and
 * goes only to the relay, as `Authorization: Bearer <key>`.
 */
export const newHostKey = () => randomBytes(32).toString('base64url')

/**
 * The id of the room a host key opens on the relay ("h1" + SHA-256 of the
 * key): the public part, put in listener links and pairing codes. The relay
 * lets only the key's holder host it (churchhub-backend signal/hostedRoomId).
 */
export const hostedRoomId = (hostKey: string) =>
  `h1${createHash('sha256').update(hostKey).digest('base64url')}`
