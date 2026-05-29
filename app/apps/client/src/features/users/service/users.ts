import { getApiUrl } from '~/config'
import { fetcher } from '../../../utils/fetcher'
import type {
  CreateUserInput,
  CreateUserResult,
  CurrentUser,
  LocalUser,
  Permission,
  RoleWithPermissions,
  UpdateUserInput,
  UserWithPermissions,
} from '../types'

interface ApiResponse<T> {
  data: T
}

/**
 * Fetches all users
 */
export async function getAllUsers(): Promise<UserWithPermissions[]> {
  const response =
    await fetcher<ApiResponse<UserWithPermissions[]>>('/api/users')
  return response.data
}

/**
 * Fetches a user by ID
 */
export async function getUserById(
  id: number,
): Promise<UserWithPermissions | null> {
  try {
    const response = await fetcher<ApiResponse<UserWithPermissions>>(
      `/api/users/${id}`,
    )
    return response.data
  } catch {
    return null
  }
}

/**
 * Creates a new user
 */
export async function createUser(
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const response = await fetcher<ApiResponse<CreateUserResult>>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return response.data
}

/**
 * Updates a user
 */
export async function updateUser(
  id: number,
  input: UpdateUserInput,
): Promise<UserWithPermissions> {
  const response = await fetcher<ApiResponse<UserWithPermissions>>(
    `/api/users/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return response.data
}

/**
 * Deletes a user
 */
export async function deleteUser(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/users/${id}`,
    { method: 'DELETE' },
  )
  return response.data.success
}

/**
 * Updates user permissions
 */
export async function updateUserPermissions(
  id: number,
  permissions: Permission[],
): Promise<UserWithPermissions> {
  const response = await fetcher<ApiResponse<UserWithPermissions>>(
    `/api/users/${id}/permissions`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions }),
    },
  )
  return response.data
}

/**
 * Sets user role
 */
export async function setUserRole(
  id: number,
  roleId: number | null,
): Promise<UserWithPermissions> {
  const response = await fetcher<ApiResponse<UserWithPermissions>>(
    `/api/users/${id}/role`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId }),
    },
  )
  return response.data
}

/**
 * Regenerates a user token
 */
export async function regenerateUserToken(
  id: number,
): Promise<CreateUserResult> {
  const response = await fetcher<ApiResponse<CreateUserResult>>(
    `/api/users/${id}/regenerate-token`,
    { method: 'POST' },
  )
  return response.data
}

/**
 * Fetches all available roles
 */
export async function getAllRoles(): Promise<RoleWithPermissions[]> {
  const response =
    await fetcher<ApiResponse<RoleWithPermissions[]>>('/api/roles')
  return response.data
}

/**
 * Fetches current authenticated user info.
 * Returns null when no session is active (server reachable but signed out).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetcher<ApiResponse<CurrentUser | null>>(
    '/api/auth/me',
  )
  return response.data ?? null
}

/**
 * Fetches the minimal user list for the local login screen.
 */
export async function getLocalUsers(): Promise<LocalUser[]> {
  const response =
    await fetcher<ApiResponse<LocalUser[]>>('/api/auth/local-users')
  return response.data
}

export interface LoginResult {
  user: CurrentUser | null
  /** One-time ticket to finalize the session via top-level navigation. */
  ticket: string
}

/**
 * Logs in as a local user, establishing the session cookie.
 * Throws when credentials are rejected.
 */
export async function login(
  userId: number,
  password?: string,
): Promise<LoginResult> {
  const response = await fetcher<ApiResponse<CurrentUser | null> & {
    ticket: string
  }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  })
  return { user: response.data ?? null, ticket: response.ticket }
}

/**
 * Builds the URL that finalizes a user switch via a top-level navigation. The
 * 302 response sets the session cookie reliably (works in the Tauri desktop
 * webview, where a cross-origin `fetch` Set-Cookie may not overwrite the
 * existing cookie) and redirects back to the current app origin.
 */
export function getLoginRedirectUrl(ticket: string): string {
  const ret = encodeURIComponent(`${window.location.origin}/`)
  return `${getApiUrl()}/api/auth/login-redirect/${encodeURIComponent(
    ticket,
  )}?return=${ret}`
}

/**
 * Builds the URL that clears the session via a top-level navigation, so the
 * cookie is reliably removed in the desktop webview. Redirects back to the app
 * (which then shows the account picker because no session is active).
 */
export function getLogoutRedirectUrl(): string {
  const ret = encodeURIComponent(`${window.location.origin}/`)
  return `${getApiUrl()}/api/auth/logout-redirect?return=${ret}`
}

/**
 * Logs out, clearing the session cookie.
 */
export async function logout(): Promise<void> {
  await fetcher('/api/auth/logout', { method: 'POST' })
}

/**
 * Sets or clears a user's login password (super-admin only).
 * Pass null to remove the password.
 */
export async function setUserPassword(
  id: number,
  password: string | null,
): Promise<UserWithPermissions> {
  const response = await fetcher<ApiResponse<UserWithPermissions>>(
    `/api/users/${id}/password`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
  )
  return response.data
}

/**
 * Generates the authentication URL for a user
 * Uses the same hostname the client used to access the app
 */
export function getUserAuthUrl(token: string): string {
  return `${getApiUrl()}/api/auth/user/${encodeURIComponent(token)}`
}

export interface NetworkInterface {
  name: string
  address: string
  family: 'IPv4' | 'IPv6'
}

/**
 * Generates an authentication URL for a specific IP address
 */
export function getUserAuthUrlForIp(token: string, ip: string): string {
  const port = import.meta.env.VITE_API_PORT || '3000'
  return `http://${ip}:${port}/api/auth/user/${encodeURIComponent(token)}`
}

/**
 * Fetches external network interfaces from the server
 */
export async function getExternalInterfaces(): Promise<NetworkInterface[]> {
  const response = await fetcher<ApiResponse<NetworkInterface[]>>(
    '/api/network/interfaces',
  )
  return response.data
}
