import { fetcher } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export type UpdateDownloadPhase =
  | 'idle'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'

export interface UpdateDownloadState {
  phase: UpdateDownloadPhase
  version: string | null
  filePath: string | null
  fileName: string | null
  receivedBytes: number
  totalBytes: number | null
  error: string | null
}

export interface UpdateDownloadConfig {
  /** The folder the operator chose, or null when the default is in use. */
  downloadDir: string | null
  /** The folder actually written to. */
  effectiveDownloadDir: string
  /** The operating system's Downloads folder. */
  defaultDir: string
}

export async function getUpdateConfig(): Promise<UpdateDownloadConfig | null> {
  const res = await fetcher<ApiResponse<UpdateDownloadConfig>>(
    '/api/app-update/config',
  )
  return res.data ?? null
}

export async function setUpdateDownloadDir(
  downloadDir: string | null,
): Promise<UpdateDownloadConfig | null> {
  const res = await fetcher<ApiResponse<UpdateDownloadConfig>>(
    '/api/app-update/config',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadDir }),
    },
  )
  return res.data ?? null
}

/**
 * Current download state. Passing the asset also answers "is this version
 * already in the folder from a previous session?", so the panel can offer
 * Install without downloading again.
 */
export async function getUpdateDownloadState(
  assetUrl?: string | null,
  version?: string,
): Promise<UpdateDownloadState | null> {
  const params = new URLSearchParams()
  if (assetUrl) params.set('url', assetUrl)
  if (version) params.set('version', version)
  const query = params.toString()
  const res = await fetcher<ApiResponse<UpdateDownloadState>>(
    `/api/app-update/status${query ? `?${query}` : ''}`,
    { cache: 'no-store' },
  )
  return res.data ?? null
}

export async function startUpdateDownload(
  url: string,
  version: string,
): Promise<UpdateDownloadState | null> {
  const res = await fetcher<ApiResponse<UpdateDownloadState>>(
    '/api/app-update/download',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, version }),
    },
  )
  return res.data ?? null
}

export async function cancelUpdateDownload(): Promise<void> {
  await fetcher('/api/app-update/cancel', { method: 'POST' })
}

/**
 * Hands the downloaded artifact to the installer. The detached helper waits for
 * the sidecar to exit — which happens when the app quits — before it replaces
 * anything, so nothing is swapped from under a running app.
 */
export async function installUpdate(): Promise<{
  success: boolean
  error?: string
}> {
  const res = await fetcher<ApiResponse<{ success: boolean }>>(
    '/api/app-update/install',
    { method: 'POST' },
  )
  if (res.error) return { success: false, error: res.error }
  return { success: true }
}
