import { fetcher } from '../../../utils/fetcher'
import type {
  CreateUserInput,
  CreateUserResult,
  CurrentUser,
  Permission,
  RoleWithPermissions,
  ServerInfo,
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
 * Fetches server info (internal IP and ports)
 */
export async function getServerInfo(): Promise<ServerInfo> {
  const response = await fetcher<ApiResponse<ServerInfo>>('/api/server-info')
  return response.data
}

/**
 * Generates the authentication URL for a user
 * Uses internal IP for QR code scanning from other devices
 */
export function getUserAuthUrl(
  token: string,
  serverInfo: ServerInfo | null,
): string {
  const ip = serverInfo?.internalIp ?? '127.0.0.1'
  const port = serverInfo?.serverPort ?? 3000
  return `http://${ip}:${port}/api/auth/user/${encodeURIComponent(token)}`
}
