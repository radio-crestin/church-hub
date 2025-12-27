import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSetting, upsertSetting } from '~/service/settings'
import type { KioskSettings, KioskStartupPage } from '../types'
import { KIOSK_SETTINGS_KEYS } from '../types'

const QUERY_KEY = ['kiosk-settings']

export function useKioskSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<KioskSettings> => {
      const [enabled, startupPage] = await Promise.all([
        getSetting('app_settings', KIOSK_SETTINGS_KEYS.ENABLED),
        getSetting('app_settings', KIOSK_SETTINGS_KEYS.STARTUP_PAGE),
      ])

      return {
        enabled: enabled?.value === 'true',
        startupPage: startupPage?.value
          ? JSON.parse(startupPage.value)
          : { type: 'route', path: '/present' },
      }
    },
  })
}

export function useUpdateKioskSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<KioskSettings>) => {
      const updates: Promise<boolean>[] = []

      if (settings.enabled !== undefined) {
        updates.push(
          upsertSetting('app_settings', {
            key: KIOSK_SETTINGS_KEYS.ENABLED,
            value: String(settings.enabled),
          }),
        )
      }

      if (settings.startupPage !== undefined) {
        updates.push(
          upsertSetting('app_settings', {
            key: KIOSK_SETTINGS_KEYS.STARTUP_PAGE,
            value: JSON.stringify(settings.startupPage),
          }),
        )
      }

      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * Fetches kiosk settings directly (for use outside React components)
 */
export async function fetchKioskSettings(): Promise<KioskSettings> {
  const [enabled, startupPage] = await Promise.all([
    getSetting('app_settings', KIOSK_SETTINGS_KEYS.ENABLED),
    getSetting('app_settings', KIOSK_SETTINGS_KEYS.STARTUP_PAGE),
  ])

  return {
    enabled: enabled?.value === 'true',
    startupPage: startupPage?.value
      ? (JSON.parse(startupPage.value) as KioskStartupPage)
      : { type: 'route', path: '/present' },
  }
}
