/**
 * Secrets at rest: every password, API key and token the server stores is
 * sealed with a data key that lives outside the database (the OS secret
 * store, or a key file when there is none). Features seal and open their
 * values here; docs/secrets-at-rest.md explains the design.
 */
export { loadDataKey } from './data-key/loadDataKey'
export { getSecretStoreStatus } from './getSecretStoreStatus'
export { SecretStoreLockedError } from './keyRing'
export { maskSettingValue } from './maskSettingValue'
export { openSecret } from './openSecret'
export { openSettingValue } from './openSettingValue'
export {
  requireSameDestination,
  SecretDestinationChangedError,
} from './requireSameDestination'
export { sealSecret } from './sealSecret'
export { sealSettingValue } from './sealSettingValue'
export { isSecretMask, SECRET_MASK } from './secretMask'
export { secretPlaces } from './secretPlaces'
export { SECRET_SETTINGS } from './secretSettingFields'
export { dismissResetFeatures } from './stored-secrets/resetFeatures'
