import { fetcher } from '../../../utils/fetcher'
import type {
  CreateDeviceInput,
  CreateDeviceResult,
  DevicePermissions,
  DeviceWithPermissions,
  UpdateDeviceInput,
} from '../types'

interface ApiResponse<T> {
  data: T
}

/**
 * Fetches all devices
 */
export async function getAllDevices(): Promise<DeviceWithPermissions[]> {
  const response =
    await fetcher<ApiResponse<DeviceWithPermissions[]>>('/api/devices')
  return response.data
}

/**
 * Fetches a device by ID
 */
export async function getDeviceById(
  id: number,
): Promise<DeviceWithPermissions | null> {
  try {
    const response = await fetcher<ApiResponse<DeviceWithPermissions>>(
      `/api/devices/${id}`,
    )
    return response.data
  } catch {
    return null
  }
}

/**
 * Creates a new device
 */
export async function createDevice(
  input: CreateDeviceInput,
): Promise<CreateDeviceResult> {
  const response = await fetcher<ApiResponse<CreateDeviceResult>>(
    '/api/devices',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return response.data
}

/**
 * Updates a device
 */
export async function updateDevice(
  id: number,
  input: UpdateDeviceInput,
): Promise<DeviceWithPermissions> {
  const response = await fetcher<ApiResponse<DeviceWithPermissions>>(
    `/api/devices/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return response.data
}

/**
 * Deletes a device
 */
export async function deleteDevice(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/devices/${id}`,
    { method: 'DELETE' },
  )
  return response.data.success
}

/**
 * Updates device permissions
 */
export async function updateDevicePermissions(
  id: number,
  permissions: DevicePermissions,
): Promise<DeviceWithPermissions> {
  const response = await fetcher<ApiResponse<DeviceWithPermissions>>(
    `/api/devices/${id}/permissions`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions }),
    },
  )
  return response.data
}

/**
 * Regenerates a device token
 */
export async function regenerateDeviceToken(
  id: number,
): Promise<CreateDeviceResult> {
  const response = await fetcher<ApiResponse<CreateDeviceResult>>(
    `/api/devices/${id}/regenerate-token`,
    { method: 'POST' },
  )
  return response.data
}

/**
 * Generates the authentication URL for a device
 */
export function getDeviceAuthUrl(token: string): string {
  const PORT =
    window.__serverConfig?.serverPort ??
    import.meta.env.VITE_SERVER_PORT ??
    3000
  return `http://localhost:${PORT}/api/auth/device/${encodeURIComponent(token)}`
}
