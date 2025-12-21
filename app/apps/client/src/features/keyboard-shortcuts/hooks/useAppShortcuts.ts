import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { getSetting, upsertSetting } from '~/service/settings'
import {
  DEFAULT_SHORTCUTS_CONFIG,
  type GlobalShortcutActionId,
  type GlobalShortcutsConfig,
  type ShortcutActionConfig,
} from '../types'

const SETTINGS_KEY = 'global_keyboard_shortcuts'

export function useAppShortcuts() {
  const queryClient = useQueryClient()

  const { data: setting, isLoading } = useQuery({
    queryKey: ['app_settings', SETTINGS_KEY],
    queryFn: () => getSetting('app_settings', SETTINGS_KEY),
  })

  const mutation = useMutation({
    mutationFn: (config: GlobalShortcutsConfig) =>
      upsertSetting('app_settings', {
        key: SETTINGS_KEY,
        value: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['app_settings', SETTINGS_KEY],
      })
    },
  })

  const shortcuts = useMemo<GlobalShortcutsConfig>(() => {
    if (!setting?.value) return DEFAULT_SHORTCUTS_CONFIG
    try {
      return JSON.parse(setting.value) as GlobalShortcutsConfig
    } catch {
      return DEFAULT_SHORTCUTS_CONFIG
    }
  }, [setting])

  const updateActionShortcuts = useCallback(
    async (actionId: GlobalShortcutActionId, config: ShortcutActionConfig) => {
      const updated: GlobalShortcutsConfig = {
        ...shortcuts,
        actions: {
          ...shortcuts.actions,
          [actionId]: config,
        },
      }
      await mutation.mutateAsync(updated)
    },
    [shortcuts, mutation],
  )

  const updateFullConfig = useCallback(
    async (config: GlobalShortcutsConfig) => {
      await mutation.mutateAsync(config)
    },
    [mutation],
  )

  return {
    shortcuts,
    isLoading,
    isSaving: mutation.isPending,
    updateActionShortcuts,
    updateFullConfig,
  }
}
