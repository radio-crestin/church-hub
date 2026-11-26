import { fetcher } from '~/utils/fetcher'

/** What a restore from another computer leaves to set up again. */
export type SecretFeature =
  | 'youtube'
  | 'google-drive'
  | 'cloud-sync'
  | 'listener-link'
  | 'remote-access'
  | 'cloud-backup'
  | 'obs'
  | 'song-sources'
  | 'ai-search'
  | 'live-translation'
  | 'users'

export interface SecretStoreStatus {
  /** Where the key sealing saved secrets is kept; null while locked. */
  keptIn: 'keychain' | 'credential-manager' | 'secret-service' | 'file' | null
  locked: boolean
  resetFeatures: SecretFeature[]
}

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getSecretStoreStatus(): Promise<SecretStoreStatus> {
  const res = await fetcher<ApiResponse<SecretStoreStatus>>('/api/secret-store')
  if (!res.data) throw new Error(res.error || 'Failed to load the key status')
  return res.data
}

export async function dismissResetFeatures(): Promise<void> {
  await fetcher('/api/secret-store/reset-features', { method: 'DELETE' })
}
