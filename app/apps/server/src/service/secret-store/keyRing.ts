/**
 * The data keys this server holds in memory: the active one, which seals
 * every new value, and any other it found while opening older values (a
 * backup restored from another data folder on this computer). Keys never
 * reach the database; see data-key/loadDataKey.
 */
export type KeyStore = 'os' | 'file'

export interface DataKey {
  id: string
  key: Buffer
}

export class SecretStoreLockedError extends Error {
  constructor(reason: string) {
    super(`The data key is not available: ${reason}`)
    this.name = 'SecretStoreLockedError'
  }
}

let active: DataKey | null = null
let activeStore: KeyStore | null = null
let lockedReason: string | null = null
const known = new Map<string, Buffer>()

export function setActiveKey(dataKey: DataKey, store: KeyStore): void {
  active = dataKey
  activeStore = store
  lockedReason = null
  known.set(dataKey.id, dataKey.key)
}

export function markLocked(reason: string): void {
  lockedReason = reason
}

export const rememberKey = (dataKey: DataKey) =>
  known.set(dataKey.id, dataKey.key)

export const knownKey = (id: string) => known.get(id) ?? null

export const hasActiveKey = () => active !== null

/** The key new values are sealed with; throws while it can't be opened. */
export function activeKey(): DataKey {
  if (active) return active
  throw new SecretStoreLockedError(lockedReason ?? 'not loaded yet')
}

export const keyRingState = () => ({
  store: activeStore,
  keyId: active?.id ?? null,
  lockedReason: active ? null : lockedReason,
})
