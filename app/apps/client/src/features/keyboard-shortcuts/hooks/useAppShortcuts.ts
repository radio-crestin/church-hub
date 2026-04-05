import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { getSetting, upsertSetting } from '~/service/settings'
import { createLogger } from '~/utils/logger'
import type { MIDIConfig } from '../midi/types'
import { DEFAULT_MIDI_CONFIG } from '../midi/types'
import {
  DEFAULT_SHORTCUTS_CONFIG,
  type GlobalShortcutActionId,
  type GlobalShortcutsConfig,
  type ShortcutActionConfig,
} from '../types'

const logger = createLogger('app:keyboard')
const SETTINGS_KEY = 'global_keyboard_shortcuts'

export function useAppShortcuts() {
  const queryClient = useQueryClient()

  const { data: setting, isLoading } = useQuery({
    queryKey: ['app_settings', SETTINGS_KEY],
    queryFn: () => getSetting('app_settings', SETTINGS_KEY),
  })

  const mutation = useMutation({
    mutationFn: async (config: GlobalShortcutsConfig) => {
      logger.info('Saving keyboard shortcuts config')
      const success = await upsertSetting('app_settings', {
        key: SETTINGS_KEY,
        value: JSON.stringify(config),
      })
      if (!success) {
        logger.error('Failed to save shortcuts config')
        throw new Error('Failed to save shortcuts')
      }
      logger.debug('Shortcuts config saved')
      return success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['app_settings', SETTINGS_KEY],
      })
    },
  })

  const shortcuts = useMemo<GlobalShortcutsConfig>(() => {
    if (!setting?.value) return DEFAULT_SHORTCUTS_CONFIG
    try {
      const saved = JSON.parse(setting.value) as GlobalShortcutsConfig
      // Merge with defaults to ensure new actions are always present
      return {
        ...DEFAULT_SHORTCUTS_CONFIG,
        ...saved,
        actions: {
          ...DEFAULT_SHORTCUTS_CONFIG.actions,
          ...saved.actions,
        },
      }
    } catch {
      return DEFAULT_SHORTCUTS_CONFIG
    }
  }, [setting])

  const midiConfig = useMemo<MIDIConfig>(() => {
    return shortcuts.midi ?? DEFAULT_MIDI_CONFIG
  }, [shortcuts])

  const updateActionShortcuts = useCallback(
    async (actionId: GlobalShortcutActionId, config: ShortcutActionConfig) => {
      logger.info(
        `Updating shortcut action: ${actionId}, enabled=${config.enabled}, shortcuts=${config.shortcuts.join(',')}`,
      )
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

  const updateMIDIConfig = useCallback(
    async (config: MIDIConfig) => {
      const updated: GlobalShortcutsConfig = {
        ...shortcuts,
        midi: config,
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
    midiConfig,
    isLoading,
    isSaving: mutation.isPending,
    updateActionShortcuts,
    updateMIDIConfig,
    updateFullConfig,
  }
}
