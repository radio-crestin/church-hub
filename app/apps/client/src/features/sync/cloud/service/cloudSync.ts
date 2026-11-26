import { fetcher } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** Why the owner signs in: turn sync on, claim a guest church, manage, or curate the Church Hub Library. */
export type OwnerSignInIntent = 'connect' | 'claim' | 'manage' | 'curate'

/** A church server the signed-in owner owns, or is offered by a transfer. */
export interface OwnedChurch {
  churchId: string
  name: string
  role: 'owner' | 'pending'
  createdAt: number
  updatedAt: number
  serverLastSeenAt: number | null
  deviceCount: number
}

/** Owner actions recover a church and write its library: give them time. */
const OWNER_ACTION_TIMEOUT_MS = 60_000

async function call<T>(
  url: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetcher<ApiResponse<T>>(url, {
    method,
    timeout: OWNER_ACTION_TIMEOUT_MS,
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
  if (res.data === undefined) throw new Error(res.error || 'request_failed')
  return res.data
}

/** Turns cloud sync on as a guest church (no Google account). */
export function connectAsGuest(): Promise<unknown> {
  return call('/api/sync/cloud', 'POST', {})
}

export function disconnectCloud(): Promise<unknown> {
  return call('/api/sync/cloud', 'DELETE')
}

/** The Google sign-in page to open; the server finishes the rest. */
export function startOwnerSignIn(
  intent: OwnerSignInIntent,
): Promise<{ authUrl: string }> {
  return call('/api/sync/cloud/owner/sign-in', 'POST', { intent })
}

export function signOutOwner(): Promise<unknown> {
  return call('/api/sync/cloud/owner/sign-out', 'POST')
}

export function listOwnerChurches(): Promise<{
  email: string
  churches: OwnedChurch[]
}> {
  return call('/api/sync/cloud/owner/churches', 'GET')
}

function churchUrl(churchId: string, action: string): string {
  return `/api/sync/cloud/owner/churches/${encodeURIComponent(churchId)}/${action}`
}

export function recoverChurch(churchId: string): Promise<unknown> {
  return call(churchUrl(churchId, 'recover'), 'POST')
}

export function acceptChurch(churchId: string): Promise<unknown> {
  return call(churchUrl(churchId, 'accept'), 'POST')
}

export function transferChurch(
  churchId: string,
  email: string,
): Promise<{ pendingOwnerEmail: string }> {
  return call(churchUrl(churchId, 'transfer'), 'POST', { email })
}

/** Revokes every device and moves the church to a new path. */
export function revokeAllDevices(): Promise<unknown> {
  return call('/api/sync/cloud/owner/reset', 'POST')
}

/** After another PC turned up with this church: which one keeps it. */
export function keepChurch(here: boolean): Promise<unknown> {
  return call('/api/sync/cloud/keep', 'POST', { here })
}
