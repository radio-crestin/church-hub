/**
 * The OS secret store, through Bun.secrets (built into the runtime, so the
 * compiled sidecar needs no native module): macOS Keychain, Windows
 * Credential Manager, or the Secret Service (GNOME Keyring, KWallet) over
 * libsecret on Linux.
 */
export const OS_STORE_SERVICE = 'Church Hub'
/** Long enough to answer a Linux keyring's unlock prompt. */
const TIMEOUT_MS = 20_000

export type OsStoreName = 'keychain' | 'credential-manager' | 'secret-service'

export const osStoreName = (): OsStoreName =>
  process.platform === 'darwin'
    ? 'keychain'
    : process.platform === 'win32'
      ? 'credential-manager'
      : 'secret-service'

export const osEntryName = (keyId: string) => `data-key-${keyId}`

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} timed out after ${TIMEOUT_MS} ms`)),
      TIMEOUT_MS,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * The key stored under `keyId`, or null when the store answers that it has
 * none. Throws when the store can't be reached (none installed, locked,
 * refused or timed out): the caller must not take that as "missing".
 */
export async function readOsKey(keyId: string): Promise<Buffer | null> {
  const value = await withTimeout(
    Bun.secrets.get({ service: OS_STORE_SERVICE, name: osEntryName(keyId) }),
    'Reading the data key from the OS secret store',
  )
  return value ? Buffer.from(value, 'base64') : null
}

/**
 * Stores a new key. On macOS any app of this user may read it without a
 * prompt: the app is not code-signed, so an item tied to the app would ask
 * for the user's password after every update. The key is still out of the
 * data folder and of every backup, and the keychain keeps it encrypted.
 */
export async function writeOsKey(keyId: string, key: Buffer): Promise<void> {
  await withTimeout(
    Bun.secrets.set({
      service: OS_STORE_SERVICE,
      name: osEntryName(keyId),
      value: key.toString('base64'),
      allowUnrestrictedAccess: true,
    }),
    'Saving the data key in the OS secret store',
  )
}
