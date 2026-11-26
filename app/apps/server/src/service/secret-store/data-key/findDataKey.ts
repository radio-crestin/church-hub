import { readOsKey } from './osKeyStore'
import { createLogger } from '../../../utils/logger'
import { keyRingState, knownKey, rememberKey } from '../keyRing'

const logger = createLogger('secret-store')

export type FoundKey = Buffer | 'missing' | 'unavailable'

/**
 * The key a sealed value names, when it isn't the active one: another data
 * folder's key on this computer (its backup restored here) is in the same
 * OS store. "missing" means the value came from another computer and will
 * never open; "unavailable" that the store couldn't answer, so the value
 * must be kept. A server keeping its own key in a file has no OS store.
 */
export async function findDataKey(keyId: string): Promise<FoundKey> {
  const known = knownKey(keyId)
  if (known) return known
  if (keyRingState().store !== 'os') return 'missing'
  try {
    const key = await readOsKey(keyId)
    if (!key) return 'missing'
    rememberKey({ id: keyId, key })
    return key
  } catch (error) {
    logger.warning(`Could not look up data key ${keyId}: ${error}`)
    return 'unavailable'
  }
}
