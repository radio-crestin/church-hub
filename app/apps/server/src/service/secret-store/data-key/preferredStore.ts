/**
 * Where a new data key goes: CHURCH_HUB_SECRET_STORE=os insists on the OS
 * secret store, =file keeps it in the data folder (tests, and headless
 * Linux by choice), and unset tries the OS store first.
 */
export type StorePreference = 'os' | 'file' | 'auto'

export function preferredStore(): StorePreference {
  const value = process.env.CHURCH_HUB_SECRET_STORE
  return value === 'os' || value === 'file' ? value : 'auto'
}
