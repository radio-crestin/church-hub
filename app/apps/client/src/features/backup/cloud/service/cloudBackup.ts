import { fetcher } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** This PC's Church Hub Cloud sign-in and automatic schedule. */
export interface CloudBackupStatus {
  signedIn: boolean
  email: string | null
  autoBackupEnabled: boolean
  intervalHours: number
  lastBackupAt: number | null
}

/** A backup kept in Church Hub Cloud. */
export interface CloudBackupFile {
  id: string
  /** Bytes as stored (encrypted and compressed). */
  sizeBytes: number
  createdAt: number
  appVersion: string
}

/** How much of the free storage the account uses, and its limits. */
export interface CloudBackupUsage {
  usedBytes: number
  quotaBytes: number
  maxBackupBytes: number
  maxBackups: number
  uploadsPerDay: number
}

/** Uploading or restoring a large database takes a while. */
const LONG_ACTION_TIMEOUT_MS = 30 * 60 * 1000

/** A failed call, with the server's code (quota_exceeded, busy, …). */
export class CloudBackupRequestError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

async function call<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  timeout?: number,
): Promise<T> {
  const res = await fetcher<ApiResponse<T>>(url, {
    method,
    ...(timeout && { timeout }),
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
  if (res.data === undefined) {
    throw new CloudBackupRequestError(res.error || 'request_failed')
  }
  return res.data
}

export const getCloudBackupStatus = () =>
  call<CloudBackupStatus>('/api/backup/cloud/status', 'GET')

/** The Google sign-in page to open; the server finishes the rest. */
export const startCloudBackupSignIn = () =>
  call<{ authUrl: string }>('/api/backup/cloud/sign-in', 'POST')

export const listCloudBackups = () =>
  call<{ backups: CloudBackupFile[]; usage: CloudBackupUsage }>(
    '/api/backup/cloud/backups',
    'GET',
  )

export const backUpToCloudNow = () =>
  call<{ backup: CloudBackupFile }>(
    '/api/backup/cloud/backups',
    'POST',
    undefined,
    LONG_ACTION_TIMEOUT_MS,
  )

export const restoreCloudBackup = (id: string) =>
  call<{ requiresRestart: boolean }>(
    `/api/backup/cloud/backups/${encodeURIComponent(id)}/restore`,
    'POST',
    undefined,
    LONG_ACTION_TIMEOUT_MS,
  )

export const deleteCloudBackup = (id: string) =>
  call<{ deleted: boolean }>(
    `/api/backup/cloud/backups/${encodeURIComponent(id)}`,
    'DELETE',
  )

export const updateCloudBackupSchedule = (
  patch: Partial<
    Pick<CloudBackupStatus, 'autoBackupEnabled' | 'intervalHours'>
  >,
) => call<CloudBackupStatus>('/api/backup/cloud/config', 'PUT', patch)

/** Signs out; `deleteBackups` first deletes every cloud backup of the account. */
export const signOutCloudBackup = (deleteBackups: boolean) =>
  call<{ signedOut: boolean; deletedBackups: number }>(
    '/api/backup/cloud/sign-out',
    'POST',
    { deleteBackups },
  )
