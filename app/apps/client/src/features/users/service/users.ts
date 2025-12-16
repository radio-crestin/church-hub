import { getApiUrl } from '~/config'
import { fetcher } from '../../../utils/fetcher'
import type {
  CreateUserInput,
  CreateUserResult,
  CurrentUser,
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
 * Fetches current authenticated user info
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetcher<ApiResponse<CurrentUser>>('/api/auth/me')
    return response.data
  } catch {
    return null
  }
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
