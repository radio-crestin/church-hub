import { fetcher } from "../../utils/fetcher";
import type { Setting, SettingsTable, UpsertSettingInput, ApiResponse } from "./types";

/**
 * Gets a setting by key from the specified table
 */
export async function getSetting(
  table: SettingsTable,
  key: string
): Promise<Setting | null> {
  try {
    const response = await fetcher<ApiResponse<Setting>>(
      `/api/settings/${table}/${key}`
    );

    if (response.error) {
      console.error(`Failed to get setting: ${response.error}`);
      return null;
    }

    return response.data ?? null;
  } catch (error) {
    console.error(`Failed to get setting: ${error}`);
    return null;
  }
}

/**
 * Gets all settings from the specified table
 */
export async function getAllSettings(table: SettingsTable): Promise<Setting[]> {
  try {
    const response = await fetcher<ApiResponse<Setting[]>>(
      `/api/settings/${table}`
    );

    if (response.error) {
      console.error(`Failed to get all settings: ${response.error}`);
      return [];
    }

    return response.data ?? [];
  } catch (error) {
    console.error(`Failed to get all settings: ${error}`);
    return [];
  }
}

/**
 * Upserts a setting in the specified table
 */
export async function upsertSetting(
  table: SettingsTable,
  input: UpsertSettingInput
): Promise<boolean> {
  try {
    const response = await fetcher<ApiResponse<{ success: boolean }>>(
      `/api/settings/${table}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }
    );

    if (response.error) {
      console.error(`Failed to upsert setting: ${response.error}`);
      return false;
    }

    return response.data?.success ?? false;
  } catch (error) {
    console.error(`Failed to upsert setting: ${error}`);
    return false;
  }
}

/**
 * Deletes a setting from the specified table
 */
export async function deleteSetting(
  table: SettingsTable,
  key: string
): Promise<boolean> {
  try {
    const response = await fetcher<ApiResponse<{ success: boolean }>>(
      `/api/settings/${table}/${key}`,
      {
        method: "DELETE",
      }
    );

    if (response.error) {
      console.error(`Failed to delete setting: ${response.error}`);
      return false;
    }

    return response.data?.success ?? false;
  } catch (error) {
    console.error(`Failed to delete setting: ${error}`);
    return false;
  }
}
