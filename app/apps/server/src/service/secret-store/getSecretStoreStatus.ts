import { type OsStoreName, osStoreName } from './data-key/osKeyStore'
import { keyRingState } from './keyRing'
import { getResetFeatures } from './stored-secrets/resetFeatures'
import type { SecretFeature } from './stored-secrets/secretColumns'

export interface SecretStoreStatus {
  /** Where the data key is kept; null while it is locked. */
  keptIn: OsStoreName | 'file' | null
  /** The key is in the OS store but couldn't be opened at start. */
  locked: boolean
  /** What a restore from another computer left to set up again. */
  resetFeatures: SecretFeature[]
}

export function getSecretStoreStatus(): SecretStoreStatus {
  const { store, lockedReason } = keyRingState()
  return {
    keptIn: store === 'os' ? osStoreName() : store,
    locked: lockedReason !== null,
    resetFeatures: getResetFeatures(),
  }
}
