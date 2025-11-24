import type {
  ApiResponse,
  Setting,
  SettingsTable,
  UpsertSettingInput,
} from './types'
import { fetcher } from '../../utils/fetcher'

/**
 * Gets a setting by key from the specified table
 */
export async function getSetting(
  table: SettingsTable,
  key: string,
): Promise<Setting | null> {
  try {
    const response = await fetcher<ApiResponse<Setting>>(
      `/api/settings/${table}/${key}`,
    )

    if (response.error) {
      return null
    }

    return response.data ?? null
  } catch (_error) {
    return null
  }
}

/**
 * Gets all settings from the specified table
 */
export async function getAllSettings(table: SettingsTable): Promise<Setting[]> {
  try {
    const response = await fetcher<ApiResponse<Setting[]>>(
      `/api/settings/${table}`,
    )

    if (response.error) {
      return []
    }

    return response.data ?? []
  } catch (_error) {
    return []
  }
}

/**
 * Upserts a setting in the specified table
 */
export async function upsertSetting(
  table: SettingsTable,
  input: UpsertSettingInput,
): Promise<boolean> {
  try {
    const response = await fetcher<ApiResponse<{ success: boolean }>>(
      `/api/settings/${table}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )

    if (response.error) {
      return false
    }

    return response.data?.success ?? false
  } catch (_error) {
    return false
  }
}

/**
 * Deletes a setting from the specified table
 */
export async function deleteSetting(
  table: SettingsTable,
  key: string,
): Promise<boolean> {
  try {
    const response = await fetcher<ApiResponse<{ success: boolean }>>(
      `/api/settings/${table}/${key}`,
      {
        method: 'DELETE',
      },
    )

    if (response.error) {
      return false
    }

    return response.data?.success ?? false
  } catch (_error) {
    return false
  }
}
