import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Music,
  Play,
  Square,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useOBSScenes } from '~/features/livestream/hooks'
import { ShortcutActionRow } from './ShortcutActionRow'
import { useAppShortcuts } from '../hooks'
import { MIDIDeviceSelector } from '../midi/components'
import type {
  GlobalShortcutActionId,
  ShortcutActionConfig,
  ShortcutActionMeta,
} from '../types'
import type { SceneShortcutSource } from '../utils'

const SHORTCUT_ACTIONS: ShortcutActionMeta[] = [
  {
    id: 'startLive',
    labelKey: 'sections.shortcuts.actions.startLive.label',
    descriptionKey: 'sections.shortcuts.actions.startLive.description',
    icon: Play,
  },
  {
    id: 'stopLive',
    labelKey: 'sections.shortcuts.actions.stopLive.label',
    descriptionKey: 'sections.shortcuts.actions.stopLive.description',
    icon: Square,
  },
  {
    id: 'searchSong',
    labelKey: 'sections.shortcuts.actions.searchSong.label',
    descriptionKey: 'sections.shortcuts.actions.searchSong.description',
    icon: Music,
  },
  {
    id: 'searchBible',
    labelKey: 'sections.shortcuts.actions.searchBible.label',
    descriptionKey: 'sections.shortcuts.actions.searchBible.description',
    icon: BookOpen,
  },
  {
    id: 'nextSlide',
    labelKey: 'sections.shortcuts.actions.nextSlide.label',
    descriptionKey: 'sections.shortcuts.actions.nextSlide.description',
    icon: ChevronRight,
  },
  {
    id: 'prevSlide',
    labelKey: 'sections.shortcuts.actions.prevSlide.label',
    descriptionKey: 'sections.shortcuts.actions.prevSlide.description',
    icon: ChevronLeft,
  },
]

export function ShortcutsSettingsSection() {
  const { t } = useTranslation('settings')
  const { shortcuts, isLoading, updateActionShortcuts } = useAppShortcuts()
  const { scenes } = useOBSScenes()

  const sceneShortcutSources = useMemo<SceneShortcutSource[]>(() => {
    if (!scenes) return []
    return scenes.map((scene) => ({
      displayName: scene.displayName,
      shortcuts: scene.shortcuts || [],
    }))
  }, [scenes])

  const handleUpdateAction = (
    actionId: GlobalShortcutActionId,
    config: ShortcutActionConfig,
  ) => {
    updateActionShortcuts(actionId, config)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Keyboard
            size={24}
            className="text-indigo-600 dark:text-indigo-400"
          />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.shortcuts.title')}
          </h2>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Keyboard size={24} className="text-indigo-600 dark:text-indigo-400" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.shortcuts.title')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('sections.shortcuts.description')}
          </p>
        </div>
      </div>

      {/* MIDI Controller Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <MIDIDeviceSelector />
      </div>

      {/* Keyboard Shortcuts */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
        {SHORTCUT_ACTIONS.map((action) => (
          <ShortcutActionRow
            key={action.id}
            action={action}
            config={shortcuts.actions[action.id]}
            allShortcuts={shortcuts}
            scenes={sceneShortcutSources}
            onUpdate={(config) => handleUpdateAction(action.id, config)}
          />
        ))}
      </div>
    </div>
  )
}
