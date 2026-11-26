import { hashToken } from '../hashToken'
import type { SyncStore } from '../state/ChurchState'

/**
 * Which churches an account owns (or is offered), as empty marker objects
 * `sync-owners/<hmac(email)>/<churchId>` next to the encrypted states: a
 * listing finds them, no database needed. The state stays the authority:
 * a marker is only a hint to read it.
 */
async function ownerPrefix(email: string, store: SyncStore): Promise<string> {
  return `sync-owners/${await hashToken(`owner-email:${email}`, store.secret)}/`
}

export async function addOwnerMarker(
  store: SyncStore,
  email: string,
  churchId: string
): Promise<void> {
  await store.states.put(
    `${await ownerPrefix(email, store)}${churchId}`,
    new Uint8Array(),
    { contentType: 'application/octet-stream', cacheControl: 'no-store' }
  )
}

export async function removeOwnerMarker(
  store: SyncStore,
  email: string,
  churchId: string
): Promise<void> {
  await store.states.delete(`${await ownerPrefix(email, store)}${churchId}`)
}

export async function listOwnerMarkers(
  store: SyncStore,
  email: string
): Promise<string[]> {
  const prefix = await ownerPrefix(email, store)
  const keys = await store.states.list(prefix)
  return keys.map((key) => key.slice(prefix.length)).filter(Boolean)
}
