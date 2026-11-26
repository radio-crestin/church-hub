import { cloudBackupRequest } from './cloudBackupRequest'

/**
 * The signed-in account's key: what each backup's own key is wrapped with.
 * Asked of the service each time, never stored on this PC.
 */
export async function getAccountKey(): Promise<{
  key: Buffer
  keyVersion: number
}> {
  const { key, keyVersion } = await cloudBackupRequest<{
    key: string
    keyVersion: number
  }>('GET', '/backup/key')
  return { key: Buffer.from(key, 'base64url'), keyVersion }
}
