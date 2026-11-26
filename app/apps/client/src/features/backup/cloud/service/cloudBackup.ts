import { fetcher } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
  usedBytes?: number
  reservedBytes?: number
  neededBytes?: number
  quotaBytes?: number
}

/** This PC's Church Hub Cloud sign-in and automatic schedule. */
export interface CloudBackupStatus {
  /** False while this build points at the legacy backend (not available yet). */
  available: boolean
  signedIn: boolean
  email: string | null
  autoBackupEnabled: boolean
  intervalHours: number
  lastBackupAt: number | null
}

/** A backup kept in Church Hub Cloud. */
export interface CloudBackupFile {
  id: string
  /** Its own bytes: the church's encrypted data (shared resources apart). */
  sizeBytes: number
  createdAt: number
  appVersion: string
}

/** How much of the free storage the account uses, and its limits. */
export interface CloudBackupUsage {
  usedBytes: number
  quotaBytes: number
  maxBackupBytes: number
  retentionDays: number
  uploadsPerDay: number
}

/** Uploading or restoring a large database takes a while. */
const LONG_ACTION_TIMEOUT_MS = 30 * 60 * 1000

/** A quota refusal's numbers, to say how much is free. */
export interface QuotaNumbers {
  usedBytes?: number
  reservedBytes?: number
  neededBytes?: number
  quotaBytes?: number
}

/** A failed call, with the server's code (quota_exceeded, busy, …). */
export class CloudBackupRequestError extends Error {
  constructor(
    readonly code: string,
    readonly quota: QuotaNumbers = {},
  ) {
    super(code)
  }
}

async function call<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  timeout?: number,
): Promise<T> {
  // Every change is JSON, even without a body: the server refuses anything
  // else, so a page on another site can't send it without a preflight.
  const res = await fetcher<ApiResponse<T>>(url, {
    method,
    ...(timeout && { timeout }),
    ...(method !== 'GET' && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),
  })
  if (res.data === undefined) {
    const { usedBytes, reservedBytes, neededBytes, quotaBytes } = res
    throw new CloudBackupRequestError(res.error || 'request_failed', {
      usedBytes,
      reservedBytes,
      neededBytes,
      quotaBytes,
    })
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

/** A single-use token the server requires for restore and delete-all. */
const confirmAction = (
  action: 'restore' | 'delete-account',
  backupId?: string,
) =>
  call<{ token: string }>('/api/backup/cloud/confirmations', 'POST', {
    action,
    backupId,
  })

/** Restores a backup; called once the operator confirmed in the dialog. */
export async function restoreCloudBackup(id: string) {
  const { token } = await confirmAction('restore', id)
  return call<{ requiresRestart: boolean }>(
    `/api/backup/cloud/backups/${encodeURIComponent(id)}/restore`,
    'POST',
    { confirmToken: token },
    LONG_ACTION_TIMEOUT_MS,
  )
}

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

/**
 * Signs out; `deleteBackups` (confirmed in the dialog) first deletes every
 * cloud backup of the account.
 */
export async function signOutCloudBackup(deleteBackups: boolean) {
  const confirmToken = deleteBackups
    ? (await confirmAction('delete-account')).token
    : undefined
  return call<{ signedOut: boolean; deletedBackups: number }>(
    '/api/backup/cloud/sign-out',
    'POST',
    { deleteBackups, confirmToken },
  )
}
